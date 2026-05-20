const express = require('express')
const healthRoutes = require('./routes/health.routes')
const authRoutes = require('./routes/auth.routes')
const userRoutes = require('./routes/user.routes')
const diaryRoutes = require('./routes/diary.routes')
const notFoundMiddleware = require('./middleware/notFound.middleware')
const errorMiddleware = require('./middleware/error.middleware')

const app = express()

app.use(express.json())
app.use('/api', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/diary-entries', diaryRoutes)
app.use(notFoundMiddleware)
app.use(errorMiddleware)

module.exports = {
  app,
}
