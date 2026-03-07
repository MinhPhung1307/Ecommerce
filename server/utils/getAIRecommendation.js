// Get AI product recommendations based on user prompt and available products
export const getAIRecommendation = async  (req, res, userPrompt, products) => {
    const API_KEY = process.env.GEMINI_API_KEY;
    const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    try {
        // Build the prompt sent to the AI model
        // Includes the list of available products and the user's request
        const geminiPrompt = `
            Here is a list of avaiable products:
            ${JSON.stringify(products, null, 2)}

            Based on the following user request, filter and suggest the best matching products:
            "${userPrompt}"

            Only return the matching products in JSON format.
        `

        // Send POST request to Gemini API
        const response = await fetch(URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: geminiPrompt }] }],
            }),
        });
        // Convert response to JSON
        const data = await response.json();

        // Check if the API returned an error
        if(data.error){
            throw new Error(data.error.message);
        }

        // Extract AI response text from Gemini output
        const aiResponseText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        // Remove markdown code block (```json ... ```) if AI returns formatted JSON
        const cleanedText = aiResponseText.replace(/```json|```/g, ``).trim();

        // If AI response is empty or invalid
        if (!cleanedText) {
            return res.status(500).json({
                success: false,
                message: 'AI response is empty or invalid.'
            })
        }

        let parsedProducts;
        try {
            // Parse the JSON string returned by AI
            parsedProducts = JSON.parse(cleanedText);
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Failed to parse AI response'
            });
        }

        // Return the filtered product recommendations
        return {
            success: true,
            products: parsedProducts
        }
    } catch (error) {
        // Handle unexpected server or API errors
        res.status(500).json({
            success: false,
            message: 'Internal server error.'
        })
    }
}