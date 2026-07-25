/**
 * Circuit Challenge AI Grading Service
 *
 * Uses Google Gemini Vision API to evaluate student circuit screenshots
 * against the expected answer. Returns a score (0-100) and reasoning.
 *
 * Environment:
 *   GEMINI_API_KEY — required
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

interface GradingResult {
  score: number
  feedback: string
}

/**
 * Fetch an image from a URL and return its base64 representation + MIME type.
 */
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`)

  const contentType = res.headers.get('content-type') || 'image/png'
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  return { base64, mimeType: contentType }
}

/**
 * Grade a student's circuit screenshot using Gemini Vision.
 *
 * @param screenshotUrl  - Public URL of the student's uploaded screenshot
 * @param questionText   - The circuit challenge question
 * @param referenceAnswer - Text description of the expected correct answer
 * @param referenceImageUrl - Optional URL of a reference answer image
 */
export async function gradeCircuitSubmission(
  screenshotUrl: string,
  questionText: string,
  referenceAnswer: string | null,
  referenceImageUrl: string | null
): Promise<GradingResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    // Fallback: return a default score when no API key is configured
    return {
      score: 50,
      feedback:
        'AI grading unavailable — API key not configured. This is a placeholder score. Please configure GEMINI_API_KEY for real grading.',
    }
  }

  try {
    // Build the image parts for the request
    const studentImage = await fetchImageAsBase64(screenshotUrl)
    const imageParts: Array<{ inline_data: { mime_type: string; data: string } }> = [
      { inline_data: { mime_type: studentImage.mimeType, data: studentImage.base64 } },
    ]

    // If a reference image is provided, include it
    if (referenceImageUrl) {
      try {
        const refImage = await fetchImageAsBase64(referenceImageUrl)
        imageParts.push({
          inline_data: { mime_type: refImage.mimeType, data: refImage.base64 },
        })
      } catch {
        // Reference image failed to load — continue without it
        console.warn('Reference image failed to load, grading without it')
      }
    }

    // Build the prompt
    const refContext = referenceAnswer
      ? `\nExpected correct answer/approach: ${referenceAnswer}`
      : ''
    const refImgNote = referenceImageUrl
      ? '\nA reference image of the correct circuit is also provided (second image).'
      : ''

    const prompt = `You are an expert electrical and electronics engineering instructor grading a student's circuit design submission.

QUESTION: ${questionText}
${refContext}${refImgNote}

The student's submitted circuit screenshot is the first image.

GRADING INSTRUCTIONS:
1. Analyze the student's circuit carefully.
2. Compare it against the question requirements${referenceAnswer ? ' and expected answer' : ''}.
3. Check for: correct components used, proper connections, correct topology, functionality.
4. Score from 0 to 100 where:
   - 0-20: Completely wrong or blank
   - 21-40: Major errors, wrong approach
   - 41-60: Partial understanding, some correct elements
   - 61-80: Mostly correct with minor issues
   - 81-100: Excellent, meets all requirements

RESPOND IN EXACTLY THIS JSON FORMAT (no markdown, no code fences):
{"score": <number>, "feedback": "<brief 2-3 sentence explanation>"}`

    // Build request body
    const parts: Array<Record<string, unknown>> = [
      ...imageParts.map((img) => ({ inline_data: img.inline_data })),
      { text: prompt },
    ]

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 300,
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Gemini API error:', errText)
      throw new Error(`Gemini API returned ${response.status}`)
    }

    const data = await response.json()
    const textResponse =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Parse the JSON response
    const jsonMatch = textResponse.match(/\{[\s\S]*"score"\s*:\s*\d+[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
        feedback: String(parsed.feedback || 'No feedback provided.'),
      }
    }

    // Fallback: try to extract score from text
    const scoreMatch = textResponse.match(/(\d{1,3})/)
    return {
      score: scoreMatch ? Math.min(100, Number(scoreMatch[1])) : 50,
      feedback: textResponse.slice(0, 500) || 'AI response could not be parsed.',
    }
  } catch (err) {
    console.error('Circuit grading error:', err)
    return {
      score: 0,
      feedback: `Grading failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again or grade manually.`,
    }
  }
}
