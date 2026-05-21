const crypto = require("crypto")

module.exports = (secret, options = {}) => {
    if (!secret || typeof secret !== "string") {
        throw new Error("A valid secret string must be provided for shoppyhook.")
    }

    return (req, res, next) => {
        if (req.complete) {
            return res.status(500).send("Stream already consumed. Ensure shoppyhook is used before other body parsers.")
        }

        const chunks = []
        let bodySize = 0

        //10MB payload limit, avoid large payload attacks
        const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024

        req.on("data", chunk => {
            bodySize += chunk.length
            if (bodySize > MAX_PAYLOAD_SIZE) {
                return res.status(413).send("Payload Too Large")
            }

            chunks.push(chunk)
        })

        req.on("end", () => {
            if (bodySize > MAX_PAYLOAD_SIZE) return

            //concatenate chunks
            req.rawBody = Buffer.concat(chunks).toString("utf-8")

            try {
                console.log("Raw body:", req.rawBody) // Debug log for raw body
                req.body = JSON.parse(req.rawBody)
            } catch (_) {
                return res.status(400).send("Invalid JSON payload")
            }

            try {
                //get signature
                const signatureHeader = req.headers["x-shoppy-signature"]
                if (!signatureHeader) return res.status(400).send("Missing signature header")

                //create hmac
                const hmac = crypto.createHmac("sha512", secret)

                //compare signatures
                const expectedSignature = Buffer.from(hmac.update(req.rawBody, "utf-8").digest("hex"))
                const actualSignature = Buffer.from(signatureHeader)
                if (expectedSignature.length !== actualSignature.length || !crypto.timingSafeEqual(expectedSignature, actualSignature)) {
                    return res.status(401).send("Invalid signature")
                }

                next()
            } catch (err) {
                res.status(500).send("Error during signature verification")
            }
        })
    }
}