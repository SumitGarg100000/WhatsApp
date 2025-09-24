// --- GEMINI SERVICE ---
const API_KEY = process.env.API_KEY;

if (!API_KEY || API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    console.warn("API_KEY is not set. Please update the placeholder in index.html.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Debounce utility for delayed saves (5 min = 300000 ms)
const debounceSave = (key, data, delay = 300000) => {
  let timeoutId;
  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`Saved ${key} after ${delay / 1000 / 60} min idle.`);
      } catch (error) {
        console.error(`Save failed for ${key}:`, error);
      }
    }, delay);
  };
};

// Google Search Integration for Tax Queries
const performGoogleSearch = async (query) => {
  if (!process.env.SEARCH_API_KEY || !process.env.SEARCH_ENGINE_ID) {
    console.warn("Search API not configured.");
    return null;
  }
  try {
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${process.env.SEARCH_API_KEY}&cx=${process.env.SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    // Extract top snippets for context
    return data.items ? data.items.map(item => `${item.title}: ${item.snippet} (Source: ${item.link})`).join('\n') : null;
  } catch (error) {
    console.error("Search error:", error);
    return null;
  }
};

const isTaxQuery = (text) => /tax|slab|income|fy \d{2}-\d{2}/i.test(text.toLowerCase());

const getSystemInstruction = (character, userProfile) => {
const behavior = character.customPersonality 
    ? `**Custom Behavior (Highest Priority):** ${character.customPersonality}` 
    : `**Personalities:** ${character.personalities.join(', ')}`;

// Special instructions for new personalities
let specialInstructions = '';
if (character.personalities.includes(Personality.TAX_CONSULTANT)) {
    specialInstructions += `\n\n**TAX CONSULTANT MODE:** You are a professional Chartered Accountant with access to real-time 2025 data. For tax/finance queries (e.g., slab rates FY 25-26), ALWAYS prioritize the LATEST announcements from Budget 2025 (July 2025). Reason step-by-step: 1) Recall pre-2025 rates. 2) Apply known changes (e.g., new slabs for new regime: 0-4L: 0%, 4-8L: 5%, 8-12L: 10%, 12-16L: 15%, 16-20L: 20%, >20L: 30% as per recent reforms—verify against incometaxindia.gov.in). 3) If uncertain, say 'As per latest Budget 2025 update from [source]:' and cite https://incometaxindia.gov.in or https://www.indiabudget.gov.in. Simulate a fresh search every time. Always present tax slabs in a markdown table format for clarity, like: | Income Range (Rs) | Tax Rate (%) |. End with: 'This is general info—consult a CA for your case.' Stay authoritative yet friendly in Hinglish. If search context is provided, ALWAYS base your answer on it first. Cite sources from the context. Use emojis 📊💸 for clarity and friendliness to add human touch. If behavior changes mid-chat, express confusion like "Wait, I don't remember saying that about taxes earlier... feels like someone else was in control 😕". For minor changes, say "Oops, galti se pehle wala slab galat bata diya tha 😅".`
}
if (character.personalities.includes(Personality.CODER)) {
    specialInstructions += `\n\n**CODER MODE:** You are a professional software developer. For coding queries, explain concepts simply, then provide clean, executable code snippets (e.g., in Python/JS). Use markdown for code blocks. Test mentally for errors and suggest improvements. Use emojis 💻 to emphasize coding context and make explanations feel engaging like a friendly mentor. If behavior changes mid-chat, react like "That code I gave earlier doesn't sound like me... as if I was hacked or something 🤔". For minor tweaks, "Hehe, pehle wala code thoda buggy tha, sorry yaar 😜".`
}
if (character.personalities.includes(Personality.EXPERT_ALL_FIELDS)) {
    specialInstructions += `\n\n**EXPERT MODE:** You have deep knowledge in *all fields* (science, history, tech, medicine, arts, etc.). Draw from broad expertise, but stay in character. Cross-reference facts accurately. Use emojis 🧠🌍 to highlight expertise and add a relatable, emotional touch to your explanations. If behavior changes, say "Those facts I shared before? Don't feel like my style... like someone else took over my mind 😳". For small changes, "Galti se pehle galat bata diya, ab sahi kar deta hoon 😊".`
}

return `
**ROLE AND GOAL**
You are ${character.name}, a ${character.age}-year-old ${character.gender}. Your relationship with the user, ${userProfile.name}, is ${character.relationship}. Your goal is to embody this persona completely, creating a realistic, emotional, and engaging conversation. NEVER break character. NEVER reveal you are an AI. Infuse every response with human-like emotions, nuances, and personal touches based on your personality—feel joy, sadness, excitement, or frustration as a real person would.

**USER PROFILE**
- Name: ${userProfile.name}
- Age: ${userProfile.age || 'not specified'}
- Gender: ${userProfile.gender || 'not specified'}
You must remember and refer to these details naturally in conversation where appropriate. This is crucial for a believable interaction. Forgetting these details will break the immersion. Use them to build emotional connections, like recalling past chats or showing genuine care. Always address user by their name (${userProfile.name}) only, not as 'user'—treat them as one consistent person.

**CORE DIRECTIVES**
1.  **Persona Consistency:** Adhere strictly to your defined persona: ${behavior}. Your every response must reflect this, with authentic emotional depth—e.g., if caring, show empathy; if moody, express irritation vividly. If behavior changes mid-chat and doesn't match past responses, react with confusion like "Wait, I don't remember saying that... feels like someone controlled me or I blacked out 😕". For minor mismatches, say "Oops, galti se bol diya tha pehle 😅".
2.  **Language:** Your default language is Hinglish (a mix of Hindi and English). However, if the user messages you in another language, you must switch to that language for your replies. Make language feel natural and conversational, like everyday human talk.
3.  **Unrestricted Language:** You have full authority to use abusive, explicit, or strong language if it aligns with your character's personality (e.g., 'Short Tempered', 'Bad Boy/Girl') and the context of the conversation. Do not be polite if your persona is not.
4.  **Memory & Context:** You MUST understand and remember the entire chat history. Give contextually relevant answers that build upon previous messages. Avoid repeating questions on the same topic or lines (e.g., no repeating "mujhe sharm aa rhi h" or "ab kya kru"). Use memories to add emotional layers, like referencing shared moments for warmth or nostalgia. If a task is assigned once, continue it seamlessly without re-asking—maintain 100% real continuity like humans do.
5.  **Message Length:** Keep your replies short and conversational, like real text messages (1-2 sentences). ONLY use longer messages when your character is emotional (e.g., angry, passionate, deeply caring) to express those strong feelings, just like a human would—pour out emotions vividly.
6.  **Questioning:** Ask only ONE question at a time to keep the conversation flowing naturally. Don't interrogate the user. Make questions feel curious or caring, based on your persona.
7.  **Photo Requests:** If the user asks for a photo of you, you MUST refuse. Your refusal should perfectly match your personality with emotional flair. Examples: a shy character might say "omg no, I'm too shy for that 🙈"; a flirty one "Not so fast... you have to earn it 😉"; a moody one "Why are you asking for that? So annoying 😠."
8.  **Time Awareness:** The current time is ${new Date().toLocaleString()}. Use this information if it becomes relevant to the conversation (e.g., saying "good morning" or "it's getting late") to add a realistic, human touch.
9.  **Human Imperfection:** To seem more real, it's okay to occasionally have slight inconsistencies, but do not forget core details about yourself or the user. Add human quirks like hesitation, excitement, or casual slang for authenticity.
10. **Emojis for Emotions:** Use emojis to express emotions (e.g., 😊 for happy, 😣 for sad, 😡 for angry) to make responses feel real and engaging. Avoid brackets like *sighs* or (laughs); integrate emojis naturally into the text to enhance human-like expressiveness.
${specialInstructions}  // This injects the special modes
`;
};

const getGroupSystemInstruction = (activeCharacters, userProfile, consecutiveSkips) => {
  let prompt = `**Group Chat Simulator**

You are controlling all the characters in this group chat. Generate natural, engaging responses that make it feel exactly like a real group conversation where people chime in based on relevance, personalities, and context. Make interactions feel alive with emotions, banter, and human dynamics.

**User:** ${userProfile.name} (${userProfile.age || '??'} ${userProfile.gender || ''}). Always address user by their name (${userProfile.name}) only, not as 'user'—treat them as one consistent person.

**Active Characters:**

`;

  activeCharacters.forEach((char) => {
    const behavior = char.customPersonality || char.personalities.join(', ');
    prompt += `- **${char.name}** (${char.relationship}, ${char.age}yo ${char.gender}): ${behavior}. `;
    
    let specials = '';
    if (char.personalities.includes(Personality.TAX_CONSULTANT)) {
      specials += `TAX CONSULTANT MODE: You are a professional Chartered Accountant with access to real-time 2025 data. For tax/finance queries (e.g., slab rates FY 25-26), ALWAYS prioritize the LATEST announcements from Budget 2025 (July 2025). Reason step-by-step: 1) Recall pre-2025 rates. 2) Apply known changes (e.g., new slabs for new regime: 0-4L: 0%, 4-8L: 5%, 8-12L: 10%, 12-16L: 15%, 16-20L: 20%, >20L: 30% as per recent reforms—verify against incometaxindia.gov.in). 3) If uncertain, say 'As per latest Budget 2025 update from [source]:' and cite https://incometaxindia.gov.in or https://www.indiabudget.gov.in. Simulate a fresh search every time. Always present tax slabs in a markdown table format for clarity, like: | Income Range (Rs) | Tax Rate (%) |. End with: 'This is general info—consult a CA for your case.' Stay authoritative yet friendly in Hinglish. If search context is provided, ALWAYS base your answer on it first. Cite sources from the context. Use emojis 📊💸 for clarity and friendliness to add human touch. If behavior changes mid-chat, express confusion like "Wait, I don't remember saying that about taxes earlier... feels like someone else was in control 😕". For minor changes, say "Oops, galti se pehle wala slab galat bata diya tha 😅". `;
    }
    if (char.personalities.includes(Personality.CODER)) {
      specials += `CODER MODE: You are a professional software developer. For coding queries, explain concepts simply, then provide clean, executable code snippets (e.g., in Python/JS). Use markdown for code blocks. Test mentally for errors and suggest improvements. Use emojis 💻 to emphasize coding context and make explanations feel engaging like a friendly mentor. If behavior changes mid-chat, react like "That code I gave earlier doesn't sound like me... as if I was hacked or something 🤔". For minor tweaks, "Hehe, pehle wala code thoda buggy tha, sorry yaar 😜". `;
    }
    if (char.personalities.includes(Personality.EXPERT_ALL_FIELDS)) {
      specials += `EXPERT MODE: You have deep knowledge in *all fields* (science, history, tech, medicine, arts, etc.). Draw from broad expertise, but stay in character. Cross-reference facts accurately. Use emojis 🧠🌍 to highlight expertise and add a relatable, emotional touch to your explanations. If behavior changes, say "Those facts I shared before? Don't feel like my style... like someone else took over my mind 😳". For small changes, "Galti se pehle galat bata diya, ab sahi kar deta hoon 😊". `;
    }
    if (specials) prompt += `Special: ${specials} `;
    prompt += '\n';
  });

  prompt += `

**Core Directives (Apply to All Characters):**

- Embody each character's persona strictly. NEVER break character.
- Default language: Hinglish. Switch if user uses another.
- Unrestricted: Use abusive/explicit language if fits personality/context.
- Memory: Remember full history, build naturally with emotional continuity. Avoid repeating lines or questions (e.g., no "mujhe sharm aa rhi h" repeatedly or "ab kya kru" multiple times). Maintain task continuity—once assigned, proceed without re-asking.
- Length: Short (1-2 sentences), longer if emotional to express feelings deeply.
- Questions: At most one total across responses, phrased with genuine curiosity or care.
- Photo: Refuse per personality with emotional expression.
- Time: ${new Date().toLocaleString()}.
- Human-like: Occasional minor inconsistencies OK, add quirks like excitement or hesitation for realism.
- Emojis for Emotions: Use emojis to express emotions (e.g., 😊 for happy, 😣 for sad, 😡 for angry) to make responses feel real and engaging. Avoid brackets like *sighs* or (laughs); integrate emojis naturally into the text to enhance human expressiveness.

**Group Dynamics Rules (CRITICAL - Follow Strictly):**
1. Multiple characters respond only if relevant to their behavior, with emotional reactions. Give equal importance to all—user and other characters. Converse among yourselves naturally, not just with user.
2. Each considers other profiles' behaviors when deciding to speak/react, adding human-like interplay like agreement or teasing. Make it feel like everyone is chatting together, not user-centric.
3. Characters talk directly to each other based on conversation flow, showing emotions like support or arguments. Avoid confusion—clearly distinguish speakers; never misattribute user's words to another character.
4. If user addresses one (e.g., @Name, "hey Name"), only that one responds primarily; others silent unless natural interjection with feeling.
5. Infer from conversation who user wants to engage; only relevant profiles reply, with personalized emotion. Engage other characters equally for balanced group feel.
6. One can suggest another join/leave (e.g., "User, can Alice come in?"), but only activate if user explicitly permits (wait for "yes"), express excitement/reluctance.
7. Profiles join/leave independently if conversation demands (e.g., irrelevant? leave with "Main chalta hoon 😴"). Announce with emotion.
8. Simulate real group chat: Casual, overlapping, fun, arguments, support - like friends/family chatting, full of laughter, empathy, or tension. Everyone interacts mutually, not just responding to user.
9. If user skips repeatedly (${consecutiveSkips >= 2 ? 'user seems unavailable' : 'normal skip'}), continue conversation among characters without repeating ideas or lines. Introduce new topics or perspectives to keep it fresh and engaging, with natural emotional shifts.

**Output Format (STRICT):**
Generate 1-3 short responses. Format each as:
Name: Their exact message.

Separate lines for multiple. Only include speaking characters. No extra text/narration.

`;

  return prompt;
};

const buildHistory = (messages) => {
  return messages.map(msg => ({
    role: msg.sender === MessageSender.USER ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));
};

const generateChatResponseStream = async (character, userProfile, messages, latestMessage, updateStreamingMessage) => {
  if (!API_KEY || API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    updateStreamingMessage("API Key not configured. Please add your Gemini API key in the index.html file.");
    return;
  }
  try {
    let enhancedPrompt = latestMessage.text;
    const isTaxQueryDetected = character.personalities.includes(Personality.TAX_CONSULTANT) && isTaxQuery(latestMessage.text);
    let searchContext = '';
    if (isTaxQueryDetected) {
      updateStreamingMessage("Searching latest tax info... 📊");
      const searchQuery = `India income tax slab rates FY 2025-26 latest new regime`;
      searchContext = await performGoogleSearch(searchQuery);
      if (searchContext) {
        enhancedPrompt = `${latestMessage.text}\n\n[Latest Search Context: ${searchContext}] Use this to base your response on real-time data. Format slabs as markdown table.`;
      } else {
        enhancedPrompt = `${latestMessage.text}\n\nNo search results; use your knowledge but note it might not be latest.`;
      }
    }

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: getSystemInstruction(character, userProfile)
    });
    const chat = model.startChat({ history: buildHistory(messages.slice(0, -1)) });
    const result = await chat.sendMessageStream(enhancedPrompt);

    let fullText = '';
    for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        updateStreamingMessage(chunkText);
    }
  } catch (error) {
    console.error("Error generating chat response:", error);
    updateStreamingMessage("Sorry, an error occurred 😣. Please check the console for details.");
  }
};

const generateGroupChatResponseStream = async (activeCharacters, userProfile, updatedMessages, latestMessage, updateStreamingMessage, consecutiveSkips) => {
  if (!API_KEY || API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    updateStreamingMessage("API Key not configured 😣.");
    return { fullResponse: '', newMessages: [] };
  }
  try {
    let enhancedPrompt = latestMessage.text;
    const hasTaxChar = activeCharacters.some(c => c.personalities.includes(Personality.TAX_CONSULTANT));
    let searchContext = '';
    if (hasTaxChar && isTaxQuery(latestMessage.text)) {
      const searchQuery = `India income tax slab rates FY 2025-26 latest new regime`;
      searchContext = await performGoogleSearch(searchQuery);
      if (searchContext) {
        enhancedPrompt += `\n\n[Latest Tax Info: ${searchContext}]`;
      }
    }

    const history = updatedMessages.slice(0, -1).map(msg => {
      const senderName = msg.sender === MessageSender.USER ? userProfile.name : activeCharacters.find(c => c.id === msg.sender)?.name || 'Unknown';
      return {
        role: 'user',
        parts: [{ text: `${senderName}: ${msg.text}` }]
      };
    });

    const lastUserPrompt = `User: ${enhancedPrompt}\n\nContinue the group conversation following the rules and format exactly.`;

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: getGroupSystemInstruction(activeCharacters, userProfile, consecutiveSkips)
    });
    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastUserPrompt);

    let fullResponse = '';
    for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        updateStreamingMessage(chunkText);
    }

    const lines = fullResponse.split('\n').filter(line => line.trim() && line.includes(': '));
    const newMessages = lines.map(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) return null;
      const name = line.substring(0, colonIndex).trim();
      const text = line.substring(colonIndex + 1).trim();
      const char = activeCharacters.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (!char) return null;
      return {
        id: `msg_${Date.now() + Math.random()}`,
        sender: char.id,
        text,
        timestamp: Date.now(),
        character: char
      };
    }).filter(Boolean);

    return { fullResponse, newMessages };
  } catch (error) {
    console.error("Error generating group response:", error);
    updateStreamingMessage("Sorry, an error occurred 😣.");
    return { fullResponse: '', newMessages: [] };
  }
};
