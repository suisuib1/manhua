const express = require('express')
const path = require('node:path')
const healthRoutes = require('./routes/health.routes')
const authRoutes = require('./routes/auth.routes')
const userRoutes = require('./routes/user.routes')
const diaryRoutes = require('./routes/diary.routes')
const generationTaskRoutes = require('./routes/generationTask.routes')
const comicChapterRoutes = require('./routes/comicChapter.routes')
const uploadRoutes = require('./routes/upload.routes')
const notFoundMiddleware = require('./middleware/notFound.middleware')
const errorMiddleware = require('./middleware/error.middleware')

const app = express()

app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))
app.use('/api', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/diary-entries', diaryRoutes)
app.use('/api/generation-tasks', generationTaskRoutes)
app.use('/api/comic-chapters', comicChapterRoutes)
app.use('/api/uploads', uploadRoutes)
app.use(notFoundMiddleware)
app.use(errorMiddleware)

module.exports = {
  app,
}
