import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = Number(process.env.PORT || 8787);

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET"
];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[WARN] Missing ${key}`);
  }
}

const allowedOrigins = (
  process.env.FRONTEND_ORIGIN || "http://localhost:5173"
)
  .split(",")
  .map(x => x.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    }
  })
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

function timingSafeHexEqual(a, b) {
  if (
    !a ||
    !b ||
    typeof a !== "string" ||
    typeof b !== "string"
  ) {
    return false;
  }

  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");

  return (
    aa.length === bb.length &&
    crypto.timingSafeEqual(aa, bb)
  );
}

function paymentSignature(orderId, paymentId) {
  return crypto
    .createHmac(
      "sha256",
      process.env.RAZORPAY_KEY_SECRET
    )
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

async function authenticate(req, res, next) {
  try {
    const auth = req.headers.authorization || "";

    const token = auth.startsWith("Bearer ")
      ? auth.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        error: "Authentication required."
      });
    }

    const { data, error } =
      await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        error: "Invalid or expired session."
      });
    }

    req.user = data.user;

    next();
  } catch (err) {
    console.error(err);

    return res.status(401).json({
      error: "Authentication failed."
    });
  }
}

/* ============================================================
   RAZORPAY WEBHOOK
   ============================================================ */

app.post(
  "/api/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature =
        req.headers["x-razorpay-signature"];

      const secret =
        process.env.RAZORPAY_WEBHOOK_SECRET;

      if (!secret) {
        return res.status(500).json({
          error: "Webhook secret is not configured."
        });
      }

      const expected = crypto
        .createHmac("sha256", secret)
        .update(req.body)
        .digest("hex");

      if (!timingSafeHexEqual(expected, signature)) {
        return res.status(400).json({
          error: "Invalid webhook signature."
        });
      }

      const event = JSON.parse(
        req.body.toString("utf8")
      );

      const eventId = event?.id;
      const eventType = event?.event;

      if (eventId) {
        const { data: existing } =
          await supabaseAdmin
            .from("razorpay_webhook_events")
            .select("id")
            .eq("id", eventId)
            .maybeSingle();

        if (existing) {
          return res.status(200).json({
            ok: true,
            duplicate: true
          });
        }

        await supabaseAdmin
          .from("razorpay_webhook_events")
          .insert({
            id: eventId,
            event_type: eventType || "unknown"
          });
      }

      if (eventType === "payment.captured") {
        const payment =
          event?.payload?.payment?.entity;

        if (
          payment?.order_id &&
          payment?.id
        ) {
          await fulfilCapturedPayment({
            razorpayOrderId: payment.order_id,
            paymentId: payment.id,
            signature: null
          });
        }
      }

      if (eventType === "payment.failed") {
        const payment =
          event?.payload?.payment?.entity;

        if (payment?.order_id) {
          await supabaseAdmin
            .from("orders")
            .update({
              status: "cancelled"
            })
            .eq(
              "razorpay_order_id",
              payment.order_id
            )
            .eq("status", "pending");
        }
      }

      return res.status(200).json({
        ok: true
      });
    } catch (err) {
      console.error(
        "Webhook error:",
        err
      );

      return res.status(200).json({
        ok: true
      });
    }
  }
);

app.use(
  express.json({
    limit: "100kb"
  })
);

/* ============================================================
   HEALTH
   ============================================================ */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    environment:
      process.env.RAZORPAY_KEY_ID?.startsWith(
        "rzp_test_"
      )
        ? "test"
        : "unknown"
  });
});

/* ============================================================
   RAZORPAY CONFIG
   ============================================================ */

app.get("/api/config", (req, res) => {
  res.json({
    keyId:
      process.env.RAZORPAY_KEY_ID || null
  });
});

/* ============================================================
   CREATE ORDER
   ============================================================ */

app.post(
  "/api/orders/create",
  authenticate,
  async (req, res) => {
    try {
      const ids = Array.isArray(
        req.body?.datasetIds
      )
        ? [
            ...new Set(
              req.body.datasetIds.map(String)
            )
          ]
        : [];

      if (!ids.length) {
        return res.status(400).json({
          error: "No datasets selected."
        });
      }

      if (ids.length > 50) {
        return res.status(400).json({
          error:
            "Too many datasets in one order."
        });
      }

      /*
       * NEVER trust prices sent from the browser.
       */
      const {
        data: datasets,
        error: datasetError
      } = await supabaseAdmin
        .from("datasets")
        .select(
          "id,title,slug,price,currency,status,download_path,formats"
        )
        .in("id", ids)
        .eq("status", "published");

      if (datasetError) {
        throw datasetError;
      }

      if (
        !datasets ||
        datasets.length !== ids.length
      ) {
        return res.status(400).json({
          error:
            "One or more datasets are unavailable."
        });
      }

      const currency =
        datasets[0]?.currency || "INR";

      if (
        datasets.some(
          d =>
            (d.currency || "INR") !==
            currency
        )
      ) {
        return res.status(400).json({
          error:
            "Mixed currencies are not supported."
        });
      }

      const amountRupees =
        datasets.reduce(
          (sum, d) =>
            sum + Number(d.price || 0),
          0
        );

      const amountPaise =
        Math.round(amountRupees * 100);

      const {
        data: dbOrder,
        error: orderError
      } = await supabaseAdmin
        .from("orders")
        .insert({
          user_id: req.user.id,
          status:
            amountPaise > 0
              ? "pending"
              : "paid",
          amount: amountRupees,
          currency,
          payment_provider:
            amountPaise > 0
              ? "razorpay"
              : "free"
        })
        .select(
          "id,amount,currency,status"
        )
        .single();

      if (orderError) {
        throw orderError;
      }

      const { error: itemsError } =
        await supabaseAdmin
          .from("order_items")
          .insert(
            datasets.map(d => ({
              order_id: dbOrder.id,
              dataset_id: d.id,
              price: Number(
                d.price || 0
              )
            }))
          );

      if (itemsError) {
        throw itemsError;
      }

      /*
       * FREE ORDER
       */

      if (amountPaise === 0) {
        await grantDownloads(
          dbOrder.id,
          req.user.id,
          datasets
        );

        return res.json({
          free: true,
          order: {
            id: dbOrder.id,
            amount: 0,
            currency,
            status: "paid"
          }
        });
      }

      /*
       * RAZORPAY ORDER
       *
       * IMPORTANT:
       * Do NOT send capture here.
       */

      const rpOrder =
        await razorpay.orders.create({
          amount: amountPaise,
          currency,
          receipt:
            `vgis_${dbOrder.id
              .replace(/-/g, "")
              .slice(0, 24)}`,
          notes: {
            verdant_order_id:
              dbOrder.id,
            user_id:
              req.user.id
          }
        });

      const {
        error: updateError
      } = await supabaseAdmin
        .from("orders")
        .update({
          razorpay_order_id:
            rpOrder.id
        })
        .eq(
          "id",
          dbOrder.id
        );

      if (updateError) {
        throw updateError;
      }

      return res.json({
        free: false,
        order: {
          id: dbOrder.id,
          razorpayOrderId:
            rpOrder.id,
          amount: amountPaise,
          currency,
          status: "pending"
        }
      });
    } catch (err) {
      console.error(
        "Create order error:",
        err
      );

      return res.status(500).json({
        error:
          err?.message ||
          "Could not create payment order."
      });
    }
  }
);

/* ============================================================
   FULFIL CAPTURED PAYMENT
   ============================================================ */

async function fulfilCapturedPayment({
  razorpayOrderId,
  paymentId,
  signature
}) {
  const {
    data: order,
    error: orderError
  } = await supabaseAdmin
    .from("orders")
    .select(
      "id,user_id,status,amount,currency,razorpay_order_id"
    )
    .eq(
      "razorpay_order_id",
      razorpayOrderId
    )
    .maybeSingle();

  if (orderError) {
    throw orderError;
  }

  if (!order) {
    throw new Error(
      "Order not found."
    );
  }

  if (order.status === "paid") {
    return {
      order,
      alreadyPaid: true
    };
  }

  const payment =
    await razorpay.payments.fetch(
      paymentId
    );

  if (
    payment.order_id !==
    order.razorpay_order_id
  ) {
    throw new Error(
      "Payment/order mismatch."
    );
  }

  if (
    String(payment.currency) !==
    String(order.currency)
  ) {
    throw new Error(
      "Payment currency mismatch."
    );
  }

  if (
    Number(payment.amount) !==
    Math.round(
      Number(order.amount) * 100
    )
  ) {
    throw new Error(
      "Payment amount mismatch."
    );
  }

  if (
    payment.status !==
    "captured"
  ) {
    return {
      order,
      captured: false,
      paymentStatus:
        payment.status
    };
  }

  const {
    data: updated,
    error: updateError
  } = await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      payment_provider:
        "razorpay",
      payment_reference:
        paymentId,
      razorpay_payment_id:
        paymentId,
      razorpay_signature:
        signature || null,
      paid_at:
        new Date().toISOString()
    })
    .eq(
      "id",
      order.id
    )
    .neq(
      "status",
      "paid"
    )
    .select(
      "id,status,amount,currency"
    )
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (updated) {
    const {
      data: items,
      error: itemsError
    } = await supabaseAdmin
      .from("order_items")
      .select(
        "dataset_id, datasets(*)"
      )
      .eq(
        "order_id",
        order.id
      );

    if (itemsError) {
      throw itemsError;
    }

    await grantDownloads(
      order.id,
      order.user_id,
      (items || [])
        .map(x => x.datasets)
        .filter(Boolean)
    );
  }

  return {
    order:
      updated || order,
    captured: true
  };
}

/* ============================================================
   GRANT DOWNLOAD ENTITLEMENT
   ============================================================ */

async function grantDownloads(
  orderId,
  userId,
  datasets
) {
  if (!datasets?.length) {
    return;
  }

  const rows =
    datasets.map(d => ({
      user_id: userId,
      dataset_id: d.id,
      order_id: orderId
    }));

  const { error } =
    await supabaseAdmin
      .from("downloads")
      .upsert(
        rows,
        {
          onConflict:
            "user_id,dataset_id",
          ignoreDuplicates:
            true
        }
      );

  if (error) {
    throw error;
  }
}

/* ============================================================
   VERIFY PAYMENT
   ============================================================ */

app.post(
  "/api/orders/verify",
  authenticate,
  async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      } = req.body || {};

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
      ) {
        return res.status(400).json({
          error:
            "Incomplete Razorpay payment response."
        });
      }

      const {
        data: order,
        error
      } = await supabaseAdmin
        .from("orders")
        .select(
          "id,user_id,razorpay_order_id"
        )
        .eq(
          "razorpay_order_id",
          razorpay_order_id
        )
        .eq(
          "user_id",
          req.user.id
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!order) {
        return res.status(404).json({
          error:
            "Order not found."
        });
      }

      const expected =
        paymentSignature(
          order.razorpay_order_id,
          razorpay_payment_id
        );

      if (
        !timingSafeHexEqual(
          expected,
          razorpay_signature
        )
      ) {
        return res.status(400).json({
          error:
            "Payment signature verification failed."
        });
      }

      const result =
        await fulfilCapturedPayment({
          razorpayOrderId:
            order.razorpay_order_id,
          paymentId:
            razorpay_payment_id,
          signature:
            razorpay_signature
        });

      if (result.captured) {
        return res.json({
          ok: true,
          paid: true,
          order: result.order
        });
      }

      return res.status(202).json({
        ok: true,
        paid: false,
        status:
          result.paymentStatus ||
          "pending",
        message:
          "Payment authorised but not captured yet. Webhook confirmation will complete the order."
      });
    } catch (err) {
      console.error(
        "Verify payment error:",
        err
      );

      return res.status(400).json({
        error:
          err?.message ||
          "Payment verification failed."
      });
    }
  }
);

/* ============================================================
   CUSTOMER LIBRARY
   ============================================================ */

app.get(
  "/api/library",
  authenticate,
  async (req, res) => {
    try {
      const {
        data,
        error
      } = await supabaseAdmin
        .from("downloads")
        .select(
          "id,user_id,dataset_id,order_id,created_at,download_count,last_downloaded_at,datasets(id,slug,title,description,location,coverage,price,currency,formats,feature_count,crs,file_size,source,updated_label,thumbnail_url,preview_geojson_url,download_path,status)"
        )
        .eq(
          "user_id",
          req.user.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );

      if (error) {
        throw error;
      }

      return res.json({
        downloads:
          data || []
      });
    } catch (err) {
      console.error(
        "Library error:",
        err
      );

      return res.status(500).json({
        error:
          err?.message ||
          "Could not load your GIS library."
      });
    }
  }
);

/* ============================================================
   CUSTOMER DASHBOARD — SINGLE REQUEST
   ============================================================ */

app.get(
  "/api/dashboard",
  authenticate,
  async (req, res) => {
    try {
      const [libraryResult, ordersResult] = await Promise.all([
        supabaseAdmin
          .from("downloads")
          .select(
            "id,user_id,dataset_id,order_id,created_at,download_count,last_downloaded_at,datasets(id,slug,title,description,location,coverage,price,currency,formats,feature_count,crs,file_size,source,updated_label,thumbnail_url,preview_geojson_url,download_path,status)"
          )
          .eq("user_id", req.user.id)
          .order("created_at", { ascending: false }),

        supabaseAdmin
          .from("orders")
          .select(
            "id,status,amount,currency,payment_provider,payment_reference,created_at,paid_at,order_items(dataset_id,price,datasets(title,slug,formats))"
          )
          .eq("user_id", req.user.id)
          .order("created_at", { ascending: false })
      ]);

      if (libraryResult.error) throw libraryResult.error;
      if (ordersResult.error) throw ordersResult.error;

      return res.json({
        downloads: libraryResult.data || [],
        orders: ordersResult.data || []
      });
    } catch (err) {
      console.error("Dashboard error:", err);

      return res.status(500).json({
        error:
          err?.message ||
          "Could not load your GIS dashboard."
      });
    }
  }
);

/* ============================================================
   MY ORDERS
   ============================================================ */

app.get(
  "/api/my-orders",
  authenticate,
  async (req, res) => {
    try {
      const {
        data,
        error
      } = await supabaseAdmin
        .from("orders")
        .select(
          "id,status,amount,currency,payment_provider,payment_reference,created_at,paid_at,order_items(dataset_id,price,datasets(title,slug,formats))"
        )
        .eq(
          "user_id",
          req.user.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );

      if (error) {
        throw error;
      }

      return res.json({
        orders:
          data || []
      });
    } catch (err) {
      console.error(
        "Orders history error:",
        err
      );

      return res.status(500).json({
        error:
          err?.message ||
          "Could not load your orders."
      });
    }
  }
);

/* ============================================================
   SECURE DATASET DOWNLOAD
   ============================================================ */

app.post(
  "/api/download/:datasetId",
  authenticate,
  async (req, res) => {
    try {
      const datasetId =
        String(
          req.params.datasetId ||
            ""
        ).trim();

      if (!datasetId) {
        return res.status(400).json({
          error:
            "Dataset ID is required."
        });
      }

      /*
       * 1. VERIFY OWNERSHIP
       */

      const {
        data: entitlement,
        error: entitlementError
      } = await supabaseAdmin
        .from("downloads")
        .select(
          "id,dataset_id,download_count"
        )
        .eq(
          "user_id",
          req.user.id
        )
        .eq(
          "dataset_id",
          datasetId
        )
        .maybeSingle();

      if (entitlementError) {
        throw entitlementError;
      }

      if (!entitlement) {
        return res.status(403).json({
          error:
            "You have not purchased this dataset."
        });
      }

      /*
       * 2. GET DATASET
       */

      const {
        data: dataset,
        error: datasetError
      } = await supabaseAdmin
        .from("datasets")
        .select(
          "id,title,slug,download_path,status"
        )
        .eq(
          "id",
          datasetId
        )
        .maybeSingle();

      if (datasetError) {
        throw datasetError;
      }

      if (!dataset) {
        return res.status(404).json({
          error:
            "Dataset not found."
        });
      }

      if (
        dataset.status !==
        "published"
      ) {
        return res.status(404).json({
          error:
            "This dataset is not currently published."
        });
      }

      if (
        !dataset.download_path
      ) {
        return res.status(404).json({
          error:
            "This dataset does not have a downloadable source file yet."
        });
      }

      /*
       * 3. NORMALIZE STORAGE PATH
       */

      const bucket =
        "dataset-files";

      let rawPath =
        String(
          dataset.download_path
        ).trim();

      rawPath = rawPath
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(
          /^dataset-files\//i,
          ""
        )
        .replace(
          /^storage\/v1\/object\/[^/]+\//i,
          ""
        );

      if (!rawPath) {
        return res.status(404).json({
          error:
            "Download file path is empty."
        });
      }

      const storage =
        supabaseAdmin.storage.from(
          bucket
        );

      console.log(
        `[Verdant GIS] Download request: user=${req.user.id} dataset=${datasetId} path=${rawPath}`
      );

      /*
       * 4. EXACT STORAGE PATH
       */

      let resolvedPath =
        rawPath;

      let {
        data: file,
        error: storageError
      } =
        await storage.download(
          resolvedPath
        );

      /*
       * 5. FALLBACK STORAGE SEARCH
       */

      if (
        storageError ||
        !file
      ) {
        const parts =
          rawPath
            .split("/")
            .filter(Boolean);

        const fileName =
          parts.pop();

        if (!fileName) {
          return res.status(404).json({
            error:
              "Invalid downloadable file path."
          });
        }

        const folder =
          parts.join("/");

        console.log(
          `[Verdant GIS] Exact path failed. Searching Storage folder="${folder}" filename="${fileName}"`
        );

        const {
          data: objects,
          error: listError
        } =
          await storage.list(
            folder,
            {
              limit: 1000
            }
          );

        if (listError) {
          console.error(
            "[Verdant GIS] Storage list failed:",
            listError
          );
        } else {
          const match =
            (
              objects || []
            ).find(
              obj =>
                obj?.name ===
                fileName
            );

          if (match) {
            resolvedPath =
              folder
                ? `${folder}/${match.name}`
                : match.name;

            const retry =
              await storage.download(
                resolvedPath
              );

            file =
              retry.data;

            storageError =
              retry.error;
          }
        }
      }

      /*
       * 6. STORAGE FAILURE
       */

      if (
        storageError ||
        !file
      ) {
        console.error(
          "[Verdant GIS] Download failed:",
          {
            bucket,
            rawPath,
            resolvedPath,
            error:
              storageError?.message ||
              "Storage object unavailable",
            status:
              storageError?.status ||
              null,
            statusCode:
              storageError?.statusCode ||
              null
          }
        );

        return res.status(404).json({
          error:
            "The purchased dataset file could not be found in Storage.",
          bucket,
          path:
            resolvedPath
        });
      }

      /*
       * 7. FILE BUFFER
       */

      const buffer =
        Buffer.from(
          await file.arrayBuffer()
        );

      if (!buffer.length) {
        return res.status(404).json({
          error:
            "The dataset file is empty."
        });
      }

      /*
       * 8. SAFE FILE NAME
       */

      const originalName =
        resolvedPath
          .split("/")
          .pop() ||
        `${
          dataset.slug ||
          "dataset"
        }.zip`;

      const safeName =
        originalName.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

      /*
       * 9. DOWNLOAD COUNT
       */

      const nextCount =
        Number(
          entitlement.download_count ||
            0
        ) + 1;

      const {
        error: updateError
      } = await supabaseAdmin
        .from("downloads")
        .update({
          download_count:
            nextCount,
          last_downloaded_at:
            new Date().toISOString()
        })
        .eq(
          "id",
          entitlement.id
        )
        .eq(
          "user_id",
          req.user.id
        );

      if (updateError) {
        console.error(
          "[Verdant GIS] Download count update failed:",
          updateError
        );
      }

      /*
       * 10. STREAM PRIVATE ZIP
       */

      res.status(200);

      res.setHeader(
        "Content-Type",
        "application/zip"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}"`
      );

      res.setHeader(
        "Content-Length",
        String(
          buffer.length
        )
      );

      res.setHeader(
        "Cache-Control",
        "private, no-store"
      );

      console.log(
        `[Verdant GIS] Download started: ${safeName} (${buffer.length} bytes)`
      );

      return res.send(
        buffer
      );

    } catch (err) {
      console.error(
        "[Verdant GIS] Secure download error:",
        err
      );

      return res.status(500).json({
        error:
          err?.message ||
          "Could not download the dataset."
      });
    }
  }
);

/* ============================================================
   CONTACT / DATASET REQUEST
   ============================================================ */

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, organization, requestType, datasetArea, coverage, format, message, website } = req.body || {};
    if (String(website || "").trim()) return res.status(200).json({ ok: true });
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanMessage = String(message || "").trim();
    if (!cleanName || !cleanEmail || !cleanMessage) return res.status(400).json({ error: "Name, email and message are required." });
    if (cleanName.length > 120 || cleanEmail.length > 180 || cleanMessage.length > 3000) return res.status(400).json({ error: "One or more fields are too long." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: "Please enter a valid email address." });
    const { error } = await supabaseAdmin.from("contact_requests").insert({
      name: cleanName, email: cleanEmail, phone: String(phone || "").trim().slice(0, 40) || null,
      organization: String(organization || "").trim().slice(0, 160) || null,
      request_type: String(requestType || "Dataset request").trim().slice(0, 80),
      dataset_area: String(datasetArea || "").trim().slice(0, 180) || null,
      coverage: String(coverage || "").trim().slice(0, 180) || null,
      preferred_format: String(format || "").trim().slice(0, 80) || null, message: cleanMessage
    });
    if (error) { console.error("[Verdant GIS] Contact request insert failed:", error); return res.status(500).json({ error: "Could not save your request. Please try again." }); }
    return res.status(201).json({ ok: true });
  } catch (err) { console.error("[Verdant GIS] Contact request error:", err); return res.status(500).json({ error: "Could not submit your request." }); }
});

/* ============================================================
   SINGLE ORDER
   ============================================================ */

app.get(
  "/api/orders/:id",
  authenticate,
  async (req, res) => {
    const {
      data,
      error
    } = await supabaseAdmin
      .from("orders")
      .select(
        "id,status,amount,currency,payment_provider,payment_reference,created_at,paid_at,order_items(dataset_id,price,datasets(title,slug,formats))"
      )
      .eq(
        "id",
        req.params.id
      )
      .eq(
        "user_id",
        req.user.id
      )
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        error:
          error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        error:
          "Order not found."
      });
    }

    return res.json({
      order: data
    });
  }
);

/* ============================================================
   START SERVER
   ============================================================ */
app.listen(PORT, () => {
  console.log(
    `Verdant GIS payment server running at http://localhost:${PORT}`
  );
});