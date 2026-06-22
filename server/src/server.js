const path = require('node:path')

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
  quiet: true,
})

const { app } = require('./app')
const {
  startStaleGenerationTaskScanner,
} = require('./services/generationTask.service')

const port = Number(process.env.PORT || 3000)

app.listen(port, () => {
  console.log(`manhua-api listening on ${port}`)
})

startStaleGenerationTaskScanner()
