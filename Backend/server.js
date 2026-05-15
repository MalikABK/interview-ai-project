const { validateConfig, PORT } = require("./src/config/env");
validateConfig();

const app = require("./src/app")
const connectToDB = require("./src/config/database")

connectToDB()


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})