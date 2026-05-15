const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const errorHandler = require("./middlewares/error.middleware")
const logger = require("./config/logger")

const app = express()

// Simple request logger middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}))

/* routes */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")

app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

app.use(errorHandler)

module.exports = app