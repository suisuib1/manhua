const express = require('express')
const healthRoutes = require('./routes/health.routes')
const authRoutes = require('./routes/auth.routes')
const notFoundMiddleware = require('./middleware/notFound.middleware')
const errorMiddleware = require('./middleware/error.middleware')

const app = express()

app.use(express.json())
app.use('/api', healthRoutes)
app.use('/api/auth', authRoutes)
app.use(notFoundMiddleware)
app.use(errorMiddleware)

module.exports = {
  app,
}
