const pdfParse = require('pdf-parse')
const mammoth = require('mammoth')
const { ERROR_MESSAGES, HTTP_STATUS } = require('../../shared/constants')
const AppError = require('../../utils/AppError')

class ResumeParserService {
    async extractText(file) {
        const { mimetype, buffer } = file

        if (mimetype === 'application/pdf') {
            const result = await pdfParse(buffer)
            return result.text
        }

        if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer })
            return result.value
        }

        throw new AppError(ERROR_MESSAGES.UNSUPPORTED_FILE, HTTP_STATUS.BAD_REQUEST, 'INVALID_FILE_TYPE')
    }
}

module.exports = new ResumeParserService()
