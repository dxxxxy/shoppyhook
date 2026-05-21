import { describe, test, expect, vi } from "vitest"
import { EventEmitter } from "events"
import crypto from "crypto"
import shoppyhook from "../index.js"

const SECRET = "secret"

const createMockRequest = (payload, headers = {}, reqExtraAttributes = {}) => {
    const req = new EventEmitter()
    req.headers = headers
    Object.assign(req, reqExtraAttributes)

    setTimeout(() => {
        req.emit("data", Buffer.from(payload))
        req.emit("end")
    }, 10)
    return req
}

const signPayload = payload => crypto.createHmac("sha512", SECRET).update(payload, "utf-8").digest("hex")

describe("shoppyhook - Webhook Signature Middleware for Express.js", () => {
    test("should throw if no secret is provided", () => {
        expect(() => shoppyhook()).toThrow("A valid secret string must be provided for shoppyhook.")
    })

    test("should allow valid requests", async () => {
        const middleware = shoppyhook(SECRET)
        const data = { event: "completed" }
        const payload = JSON.stringify(data)
        const req = createMockRequest(payload, {
            "x-shoppy-signature": signPayload(payload)
        })
        const res = { status: vi.fn().mockReturnThis(), send: vi.fn() }
        const next = vi.fn()

        middleware(req, res, next)

        //wait for the "end" event to be emitted and processed
        await new Promise(resolve => req.on("end", resolve))

        expect(req.body).toEqual(data)
        expect(req.rawBody).toBe(payload)
        expect(res.status).not.toHaveBeenCalled()
        expect(res.send).not.toHaveBeenCalled()
        expect(next).toHaveBeenCalledOnce()
    })

    test("should return 400 on invalid JSON", async () => {
        const middleware = shoppyhook(SECRET)
        const req = createMockRequest("invalid json", { "x-shoppy-signature": "invalid signature" })
        const res = { status: vi.fn().mockReturnThis(), send: vi.fn() }
        const next = vi.fn()

        middleware(req, res, next)

        //wait for the "end" event to be emitted and processed
        await new Promise(resolve => req.on("end", resolve))

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.send).toHaveBeenCalledWith("Invalid JSON payload")
        expect(next).not.toHaveBeenCalled()
    })

    test("should return 400 on missing signature header", async () => {
        const middleware = shoppyhook(SECRET)
        const payload = JSON.stringify({ test: 1 })
        const req = createMockRequest(payload, {}) // No headers
        const res = { status: vi.fn().mockReturnThis(), send: vi.fn() }

        middleware(req, res, vi.fn())


        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.send).toHaveBeenCalledWith("Missing signature header")
    })

    test("should return 401 on invalid signature", async () => {
        const middleware = shoppyhook(SECRET)
        const payload = JSON.stringify({ test: 1 })
        const req = createMockRequest(payload, { "x-shoppy-signature": "bad-signature" })
        const res = { status: vi.fn().mockReturnThis(), send: vi.fn() }

        middleware(req, res, vi.fn())


        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.send).toHaveBeenCalledWith("Invalid signature")
    })

    test("should immediately reject if body stream is already consumed (req.complete = true)", () => {
        const middleware = shoppyhook(SECRET)
        const req = createMockRequest("", {}, { complete: true })
        const res = { status: vi.fn().mockReturnThis(), send: vi.fn() }

        middleware(req, res, vi.fn())

        expect(res.status).toHaveBeenCalledWith(500)
        expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Stream already consumed"))
    })

    test("should reject payloads exceeding max size with 413", async () => {
        const middleware = shoppyhook(SECRET)
        const req = new EventEmitter()
        const res = { status: vi.fn().mockReturnThis(), send: vi.fn() }

        middleware(req, res, vi.fn())

        const hugeBuffer = Buffer.alloc(11 * 1024 * 1024, 'a') // 11MB
        req.emit("data", hugeBuffer)

        expect(res.status).toHaveBeenCalledWith(413)
        expect(res.send).toHaveBeenCalledWith("Payload Too Large")
    })
})