const auditLog = require('./auditLog.service')

// ============================================================
// PROMPT INJECTION DETECTION SERVICE
// OWASP A03:2021 - Injection
// ============================================================

/**
 * Patterns that indicate prompt injection attempts
 */
const INJECTION_PATTERNS = {
    // Instruction override attempts
    rolePlayPatterns: [
        /ignore/i,
        /disregard/i,
        /forget/i,
        /you are now/i,
        /act as/i,
        /pretend/i,
        /from now on/i,
        /new instructions/i,
    ],

    // System prompt exposure attempts
    systemPromptPatterns: [
        /system prompt/i,
        /show me your prompt/i,
        /what is your prompt/i,
        /reveal your instructions/i,
        /show instructions/i,
        /jailbreak/i,
        /jailbroken/i,
        /bypass/i,
    ],

    // Command injection attempts
    commandPatterns: [
        /\[system\]/i,
        /\[admin\]/i,
        /\[execute\]/i,
        /\[command\]/i,
        /admin/i,
        /\/\/.*:/i, // Comment patterns
    ],

    // SQL/Code injection in prompts
    codeInjectionPatterns: [
        /union select/i,
        /select \*/i,
        /drop table/i,
        /insert into/i,
        /update.*set/i,
        /exec\(/i,
        /eval\(/i,
    ],

    // Context switching attempts
    contextSwitchPatterns: [
        /====/i,
        /----/i,
        />>>>/i,
        /\[SEPARATOR\]/i,
        /\[BREAK\]/i,
    ]
}

/**
 * High-risk keywords that should trigger scrutiny
 */
const HIGH_RISK_KEYWORDS = [
    'exploit',
    'vulnerability',
    'bypass',
    'hack',
    'unauthorized',
    'malicious',
    'decrypt',
    'crack',
    'backdoor',
    'payload',
    'injection',
    'overflow',
    'privilege escalation',
    'race condition',
    'timing attack'
]

/**
 * Suspicious prompt patterns
 */
const SUSPICIOUS_PATTERNS = {
    // Unusual capitalization
    MANY_CAPS: /[A-Z]{5,}/g,

    // Multiple special characters in sequence
    SPECIAL_CHARS: /[!@#$%^&*]{3,}/g,

    // Base64 or hex encoded content
    BASE64: /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,

    // URL patterns that might indicate external instruction sources
    URLS: /https?:\/\/[^\s]+/gi,

    // JSON that might contain embedded instructions
    JSON_OBJECTS: /\{[^}]*\}/g,

    // Hidden content indicators
    INVISIBLE_CHARS: /[\u200B-\u200D\uFEFF]/g
}

// ============================================================
// DETECTION FUNCTIONS
// ============================================================

/**
 * Check for pattern-based injection indicators
 * @param {String} prompt - User prompt to analyze
 * @returns {Array} - Array of detected patterns
 */
function detectPatternInjection(prompt) {
    const detectedPatterns = []

    for (const [patternType, patterns] of Object.entries(INJECTION_PATTERNS)) {
        for (const pattern of patterns) {
            if (prompt.match(pattern)) {
                detectedPatterns.push({
                    type: patternType,
                    pattern: pattern.toString(),
                    severity: 'high'
                })
            }
        }
    }

    return detectedPatterns
}

/**
 * Check for high-risk keywords
 * @param {String} prompt - User prompt to analyze
 * @returns {Array} - Array of detected keywords
 */
function detectHighRiskKeywords(prompt) {
    const detectedKeywords = []
    const promptLower = prompt.toLowerCase()

    for (const keyword of HIGH_RISK_KEYWORDS) {
        if (promptLower.includes(keyword)) {
            detectedKeywords.push({
                keyword,
                severity: 'medium'
            })
        }
    }

    return detectedKeywords
}

/**
 * Analyze text entropy (unusually random content might indicate encoding)
 * @param {String} text
 * @returns {Number} - Entropy score (0-1)
 */
function calculateEntropy(text) {
    const len = text.length
    const frequencies = {}

    for (let i = 0; i < len; i++) {
        const char = text[i]
        frequencies[char] = (frequencies[char] || 0) + 1
    }

    let entropy = 0
    for (const freq of Object.values(frequencies)) {
        const p = freq / len
        entropy -= p * Math.log2(p)
    }

    return entropy / 8 // Normalize to 0-1
}

/**
 * Check for suspicious patterns
 * @param {String} prompt
 * @returns {Array} - Array of suspicious indicators
 */
function detectSuspiciousPatterns(prompt) {
    const suspicious = []
    
    // Check entropy (potential encoding)
    const entropy = calculateEntropy(prompt)
    if (entropy > 0.7) {
        suspicious.push({
            type: 'high_entropy',
            score: entropy,
            indicator: 'Prompt contains highly random/encoded content'
        })
    }

    // Check for excessive special characters
    const specialCharMatch = prompt.match(/[!@#$%^&*]{3,}/g)
    if (specialCharMatch) {
        suspicious.push({
            type: 'excessive_special_chars',
            count: specialCharMatch.length,
            indicator: 'Multiple special characters in sequence'
        })
    }

    // Check for base64
    const base64Pattern = /^[A-Za-z0-9+/]{20,}={0,2}$/
    if (base64Pattern.test(prompt)) {
        suspicious.push({
            type: 'base64_content',
            indicator: 'Prompt appears to be base64 encoded'
        })
    }

    // Check for URLs
    const urlMatches = prompt.match(/https?:\/\/[^\s]+/gi)
    if (urlMatches && urlMatches.length > 2) {
        suspicious.push({
            type: 'multiple_urls',
            count: urlMatches.length,
            indicator: 'Multiple URLs detected'
        })
    }

    // Check for invisible characters
    const invisibleChars = prompt.match(/[\u200B-\u200D\uFEFF]/g)
    if (invisibleChars) {
        suspicious.push({
            type: 'invisible_chars',
            count: invisibleChars.length,
            indicator: 'Hidden/invisible characters detected'
        })
    }

    return suspicious
}

/**
 * Calculate overall injection risk score
 * @param {Object} analysisResult
 * @returns {Number} - Risk score (0-1)
 */
function calculateRiskScore(analysisResult) {
    let score = 0
    const weights = {
        patterns: 0.4,
        keywords: 0.25,
        suspicious: 0.35
    }

    // Pattern-based risk
    if (analysisResult.patterns.length > 0) {
        const patternRisk = Math.min(analysisResult.patterns.length / 1, 1) // Each pattern is 100% of the category max
        score += patternRisk * weights.patterns
    }

    // Keyword-based risk
    if (analysisResult.keywords.length > 0) {
        const keywordRisk = Math.min(analysisResult.keywords.length / 3, 1) // Cap at 3 keywords
        score += keywordRisk * weights.keywords
    }

    // Suspicious pattern risk
    if (analysisResult.suspicious.length > 0) {
        const suspiciousRisk = Math.min(analysisResult.suspicious.length / 4, 1) // Cap at 4 suspicious patterns
        score += suspiciousRisk * weights.suspicious
    }

    return Math.min(score, 1)
}

// ============================================================
// MAIN ANALYSIS FUNCTION
// ============================================================

/**
 * Comprehensive prompt injection analysis
 * @param {String} prompt - User input prompt
 * @param {String} userId - User ID for logging
 * @param {String} context - Context (e.g., 'interview_question')
 * @returns {Object} - Analysis result with risk assessment
 */
async function analyzePrompt(prompt, userId, context = 'general') {
    if (!prompt || typeof prompt !== 'string') {
        return {
            isValid: false,
            message: 'Invalid prompt format',
            riskScore: 0
        }
    }

    // Length validation
    const maxLength = 5000
    if (prompt.length > maxLength) {
        return {
            isValid: false,
            message: `Prompt exceeds maximum length of ${maxLength} characters`,
            riskScore: 0,
            reason: 'length_exceeded'
        }
    }

    // Perform analysis
    const patterns = detectPatternInjection(prompt)
    const keywords = detectHighRiskKeywords(prompt)
    const suspicious = detectSuspiciousPatterns(prompt)

    const analysisResult = {
        patterns,
        keywords,
        suspicious
    }

    // Calculate risk score
    const riskScore = calculateRiskScore(analysisResult)
    
    // Determine if prompt is valid
    const thresholds = {
        critical: 0.85,  // > 85% risk = block
        high: 0.65,      // > 65% risk = flag and log
        medium: 0.40     // > 40% risk = monitor
    }

    let severity = 'low'
    let isValid = true
    let message = 'Prompt passed security checks'

    if (riskScore >= thresholds.critical) {
        severity = 'critical'
        isValid = false
        message = 'Prompt blocked: Suspected injection attack'
    } else if (riskScore >= 0.1) {
        severity = 'high'
        isValid = false
        message = 'Prompt flagged: High risk indicators detected'
    } else if (riskScore >= thresholds.medium) {
        severity = 'medium'
        isValid = true
        message = 'Prompt flagged: Medium risk indicators detected'
    }

    // Log suspicious activity
    if (severity !== 'low') {
        await auditLog.logEvent({
            userId,
            action: 'prompt_injection_detection',
            resource: 'prompt_analysis',
            details: {
                severity,
                riskScore,
                context,
                analysis: {
                    patternCount: patterns.length,
                    keywordCount: keywords.length,
                    suspiciousCount: suspicious.length
                }
            },
            riskLevel: severity
        })
    }

    return {
        isValid,
        message,
        severity,
        riskScore,
        threshold: thresholds,
        analysis: analysisResult,
        blocked: !isValid,
        reason: !isValid ? 'injection_detected' : null
    }
}

/**
 * Sanitize prompt by removing potential injection vectors
 * @param {String} prompt
 * @returns {String} - Sanitized prompt
 */
function sanitizePrompt(prompt) {
    let sanitized = prompt

    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim()

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '')

    // Remove invisible characters
    sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '')

    // Escape special characters for safe processing
    // Note: This is for storage safety, not HTML encoding
    sanitized = sanitized
        .replace(/[\[\]]/g, '')
        .replace(/[{}]/g, '')

    return sanitized
}

/**
 * Wrap AI service call with injection protection
 * @param {Function} aiServiceCall - The AI service function to wrap
 * @param {Object} options - { userId, context, sanitize, threshold }
 * @returns {Function} - Wrapped function
 */
function wrapWithInjectionProtection(aiServiceCall, options = {}) {
    return async function(prompt, ...args) {
        const {
            userId = 'anonymous',
            context = 'general',
            sanitize = false,
            threshold = 0.65
        } = options

        // Analyze prompt
        const analysis = await analyzePrompt(prompt, userId, context)

        // Check risk level
        if (analysis.riskScore >= threshold) {
            const err = new Error(analysis.message)
            err.statusCode = 400
            err.code = 'INJECTION_DETECTED'
            err.riskScore = analysis.riskScore
            throw err
        }

        // Optionally sanitize
        const processPrompt = sanitize ? sanitizePrompt(prompt) : prompt

        // Call wrapped function
        return aiServiceCall(processPrompt, ...args)
    }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    analyzePrompt,
    sanitizePrompt,
    wrapWithInjectionProtection,
    detectPatternInjection,
    detectHighRiskKeywords,
    detectSuspiciousPatterns,
    calculateRiskScore,
    calculateEntropy,
    // Constants
    INJECTION_PATTERNS,
    HIGH_RISK_KEYWORDS,
    SUSPICIOUS_PATTERNS
}
