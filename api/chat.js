async function callAI(prompt) {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data.choices[0].message.content;

  } catch (err) {
    console.error(err);
    return "AI request failed.";
  }
}