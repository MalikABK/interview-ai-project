const { validateEnv, PORT } = require("./src/config/env");
validateEnv();

const app = require("./src/app")
const connectToDB = require("./src/config/database")

connectToDB()


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})