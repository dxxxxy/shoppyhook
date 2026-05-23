# shoppyhook
> Superseded by dxxxxy/hmacverify

A really simple and lightweight shoppy webhook middleware for express. 

It will only let webhook requests pass that have a valid signature, meaning that faking purchase webhooks is not possible (provided that you do not leak your secret). The body will then be available as a JSON object in `req.body`.

## Install
```
npm i shoppyhook
```

## Usage
```js
const shoppyhook = require("shoppyhook")

app.use("/your/shoppy/endpoint", shoppyhook("secret"))
```

### Parser issues
You need to disable any parser you have enabled for the webhook route, otherwise it will not work as it requires the raw unparsed body.

Example: Using json as a global parser through `app.use(express.json())`, I can simply replace it with this workaround, which applies it globally except for that specific shoppy webhook route.
```js
app.use(req, res, next => req.path != "/your/shoppy/endpoint" ? express.json(req, res, next) : next())
```

## Disclaimer
This is for educational purposes only. I am not responsible for any damage caused by this tool.

## License
GPLv3 © dxxxxy
