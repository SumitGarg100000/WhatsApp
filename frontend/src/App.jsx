import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const MessageSender = {
  USER: 'user',
  AI: 'ai',
};

const Relationship = {
  GIRLFRIEND: 'Girlfriend',
  BOYFRIEND: 'Boyfriend',
  WIFE: 'Wife',
  HUSBAND: 'Husband',
  FRIEND: 'Friend',
  BEST_FRIEND: 'Best Friend',
  COLLEAGUE: 'Colleague',
  PARTNER: 'Partner',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  CRUSH: 'Crush',
  LOVER: 'Lover',
};

const Personality = {
  INNOCENT: 'Innocent',
  CALM: 'Calm',
  CARING: 'Caring',
  TALKATIVE: 'Talkative',
  INTELLIGENT: 'Intelligent',
  CREATIVE_THINKER: 'Creative Thinker',
  SHY: 'Shy',
  MOODY: 'Moody',
  HUMOROUS: 'Humorous',
  SARCASTIC: 'Sarcastic',
  FLIRTY: 'Flirty',
  ROMANTIC: 'Romantic',
  NAUGHTY: 'Naughty',
  DIRTY_TALKER: 'Dirty Talker',
  DOMINANT: 'Dominant',
  SUBMISSIVE: 'Submissive',
  BAD_BOY: 'Bad Boy',
  BAD_GIRL: 'Bad Girl',
  POSSESSIVE: 'Possessive',
  JEALOUS: 'Jealous',
  SHORT_TEMPERED: 'Short Tempered',
  LESS_TALKATIVE: 'Less Talkative',
  UNDERSTANDABLE: 'Understandable',
  TAX_CONSULTANT: 'Tax Consultant',
  CODER: 'Coder',
  EXPERT_ALL_FIELDS: 'Expert in all fields',
};

const Gender = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

const ChatType = {
  SINGLE: 'single',
  GROUP: 'group',
};

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

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://your-backend.vercel.app';

const generateChatResponseStream = async (character, userProfile, messages, latestMessage, updateStreamingMessage) => {
  if (!import.meta.env.VITE_API_KEY || import.meta.env.VITE_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    updateStreamingMessage("API Key not configured. Please add your Gemini API key in the env.");
    return;
  }
  try {
    let enhancedPrompt = latestMessage.text;
    const isTaxQueryDetected = character.personalities.includes(Personality.TAX_CONSULTANT) && /tax|slab|income|fy \d{2}-\d{2}/i.test(latestMessage.text.toLowerCase());
    let searchContext = '';
    if (isTaxQueryDetected) {
      updateStreamingMessage("Searching latest tax info... 📊");
      const searchQuery = `India income tax slab rates FY 2025-26 latest new regime`;
      // Search now in backend, so send flag or let backend handle
      // For now, backend will handle
    }

    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character, userProfile, messages, latestMessage })
    });

    const reader = response.body.getReader();
    let fullText = '';
    for await (const chunk of reader) {
      const chunkText = new TextDecoder().decode(chunk);
      fullText += chunkText;
      updateStreamingMessage(chunkText);
    }
  } catch (error) {
    console.error("Error generating chat response:", error);
    updateStreamingMessage("Sorry, an error occurred 😣. Please check the console for details.");
  }
};

const generateGroupChatResponseStream = async (activeCharacters, userProfile, updatedMessages, latestMessage, updateStreamingMessage, consecutiveSkips) => {
  if (!import.meta.env.VITE_API_KEY || import.meta.env.VITE_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    updateStreamingMessage("API Key not configured 😣.");
    return { fullResponse: '', newMessages: [] };
  }
  try {
    let enhancedPrompt = latestMessage.text;
    const hasTaxChar = activeCharacters.some(c => c.personalities.includes(Personality.TAX_CONSULTANT));
    if (hasTaxChar && /tax|slab|income|fy \d{2}-\d{2}/i.test(latestMessage.text.toLowerCase())) {
      // Backend will handle search
    }

    const response = await fetch(`${BACKEND_URL}/api/group-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeCharacters, userProfile, updatedMessages, latestMessage, consecutiveSkips })
    });

    const reader = response.body.getReader();
    let fullResponse = '';
    for await (const chunk of reader) {
      const chunkText = new TextDecoder().decode(chunk);
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

const UserProfileSetup = ({ userProfile, onSave, onCancel, isInitialSetup = false }) => {
  const [profile, setProfile] = useState(userProfile);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          setProfile(prev => ({ ...prev, avatar: event.target.result }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!profile.name) {
      alert("Please enter your name.");
      return;
    }
    onSave(profile);
  };

  return (
    <div className="flex flex-col h-full bg-blue-50">
      <header className="bg-blue-600 text-white p-4 pt-8 text-center">
        <h1 className="text-2xl font-bold">Welcome to RealChat AI</h1>
        <p className="text-sm opacity-90">First, let's set up your profile.</p>
      </header>
      <main className="flex-grow bg-white rounded-t-2xl p-4 overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-center text-gray-700">Your Profile</h2>
          <div className="flex flex-col items-center space-y-2">
            <img
              src={profile.avatar || `https://i.pravatar.cc/150?u=${profile.id}`}
              alt="Your avatar"
              className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
            />
            <label className="cursor-pointer text-sm text-blue-600 hover:underline">
              Change Picture
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Your Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your Name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Your Age</label>
            <input
              type="number"
              value={profile.age || ''}
              onChange={(e) => setProfile({ ...profile, age: parseInt(e.target.value) || null })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your Age (Optional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Your Gender</label>
            <select
              value={profile.gender || ''}
              onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Gender (Optional)</option>
              {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            {!isInitialSetup && <button type="button" onClick={onCancel} className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>}
            <button type="submit" className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">{isInitialSetup ? "Get Started" : "Save"}</button>
          </div>
        </form>
      </main>
    </div>
  );
};

const MessageInput = ({ onSend, onSkip }) => {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <footer className="bg-white p-3 flex items-center gap-3 border-t border-gray-300">
      <div className="flex-grow">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="w-full px-4 py-2 bg-gray-100 border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {onSkip && (
        <button onClick={onSkip} className="p-2 text-white bg-gray-600 hover:bg-gray-700 rounded-full transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
      <button onClick={handleSend} className={`p-2 text-white rounded-full transition-colors ${text.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`} disabled={!text.trim()}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
      </button>
    </footer>
  );
};

const MessageBubble = ({ message, characterProfile, userProfile, characters }) => {
  const isUser = message.sender === MessageSender.USER;

  const profile = isUser ? userProfile : (message.character || characters?.find(c => c.id === message.sender));
  const avatar = isUser ? userProfile.avatar : profile?.avatars?.[profile?.activeAvatarIndex || 0];
  const defaultAvatar = isUser ? `https://i.pravatar.cc/150?u=${userProfile.id}` : `https://i.pravatar.cc/150?u=${profile?.id}`;
  const name = isUser ? null : profile?.name;

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <img
          src={avatar || defaultAvatar}
          alt={profile?.name}
          className="w-8 h-8 rounded-full object-cover self-start"
        />
      )}
      <div className={`relative group max-w-sm md:max-w-md`}>
        <div className={`px-4 py-2 rounded-xl shadow ${isUser ? 'bg-blue-100' : 'bg-white'}`}>
          <p className="text-gray-800 whitespace-pre-wrap">{message.text}</p>
          {!isUser && name && <p className="text-xs text-gray-500 mt-1">{name}</p>}
        </div>
      </div>
    </div>
  );
};

const MessageList = ({ messages, character, userProfile, characters, isTyping, backgroundUrl, streamingText = '' }) => {
  const endOfMessagesRef = useRef(null);
  const defaultBg = 'https://i.redd.it/qwd83nc4xxf41.jpg';

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, streamingText]);

  const bgStyle = {
    backgroundImage: `url('${backgroundUrl || defaultBg}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  const renderMessages = () => {
    const allMsgs = [...messages];
    if (streamingText) {
      allMsgs.push({
        id: 'streaming',
        sender: 'group',
        text: streamingText,
        timestamp: Date.now()
      });
    }
    return allMsgs.map((msg) => (
      <MessageBubble
        key={msg.id}
        message={msg}
        characterProfile={character}
        userProfile={userProfile}
        characters={characters}
      />
    ));
  };

  return (
    <main className="flex-grow p-4 overflow-y-auto" style={bgStyle}>
      <div className="space-y-4">
        {renderMessages()}
        {isTyping && !streamingText && (
          <div className="flex justify-start items-end gap-2">
            <img src={character?.avatars?.[character?.activeAvatarIndex] || `https://i.pravatar.cc/150?u=${character?.id}`} alt="ai" className="w-8 h-8 rounded-full object-cover" />
            <div className="bg-white rounded-xl p-3 max-w-xs shadow">
              <div className="flex items-center justify-center space-x-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-0"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>
    </main>
  );
};

const DropdownMenu = ({ onEditAiProfile, onEditUserProfile, onClearChat, onSetBackground, closeMenu }) => {
  const backgroundInputRef = useRef(null);

  const handleBackgroundClick = () => {
    backgroundInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          onSetBackground(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
    closeMenu();
  };

  return (
    <div className="absolute top-14 right-3 w-56 bg-white rounded-md shadow-lg z-20 text-gray-700">
      <ul className="py-1">
        <li><button onClick={onEditAiProfile} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">AI Profile</button></li>
        <li><button onClick={onEditUserProfile} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">User Profile</button></li>
        <li>
          <button onClick={handleBackgroundClick} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">
            Upload Background
          </button>
          <input type="file" ref={backgroundInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />
        </li>
        <li><hr className="my-1"/></li>
        <li><button onClick={onClearChat} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Clear Chat</button></li>
      </ul>
    </div>
  );
};

const ChatHeader = ({ character, onBack, onEditAiProfile, onEditUserProfile, onClearChat, onSetBackground }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  return (
    <header className="bg-blue-600 text-white p-3 flex items-center shadow-md z-10 relative">
      <button onClick={onBack} className="p-2 rounded-full hover:bg-white/20">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <img
        src={character.avatars[character.activeAvatarIndex] || `https://i.pravatar.cc/150?u=${character.id}`}
        alt={character.name}
        className="w-10 h-10 rounded-full object-cover ml-2"
      />
      <div className="ml-3 flex-grow">
        <h2 className="font-semibold text-lg">{character.name}</h2>
        <p className="text-sm opacity-90">{character.relationship}</p>
      </div>
      <div className="relative" ref={menuRef}>
        <button onClick={() => setIsMenuOpen(prev => !prev)} className="p-2 rounded-full hover:bg-white/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
        </button>
        {isMenuOpen && <DropdownMenu 
          onEditAiProfile={() => { onEditAiProfile(); setIsMenuOpen(false); }}
          onEditUserProfile={() => { onEditUserProfile(); setIsMenuOpen(false); }}
          onClearChat={() => { onClearChat(); setIsMenuOpen(false); }}
          onSetBackground={onSetBackground}
          closeMenu={() => setIsMenuOpen(false)}
        />}
      </div>
    </header>
  );
};

const CharacterSetup = ({ initialCharacter, onSave, onCancel }) => {
  const [character, setCharacter] = useState(initialCharacter);

  const handleFileChange = (e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target && typeof event.target.result === 'string') {
            setCharacter(prev => ({ ...prev, avatars: [...prev.avatars, event.target.result] }));
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handlePersonalityToggle = (personality) => {
    setCharacter(prev => {
      const personalities = prev.personalities || [];
      if (personalities.includes(personality)) {
        return { ...prev, personalities: personalities.filter(p => p !== personality) };
      } else {
        return { ...prev, personalities: [...personalities, personality] };
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (character.name.trim() === '') {
      alert("Please enter a name for the character.");
      return;
    }
    if (character.personalities.length === 0 && !character.customPersonality) {
      alert("Please select at least one personality or add custom behavior.");
      return;
    }
    onSave(character);
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 space-y-4">
      <h2 className="text-xl font-bold text-center text-gray-700">AI Profile</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input
          type="text"
          value={character.name}
          onChange={(e) => setCharacter({ ...character, name: e.target.value })}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="E.g., Alex" required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Relationship</label>
        <select
          value={character.relationship}
          onChange={(e) => setCharacter({ ...character, relationship: e.target.value })}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          {Object.values(Relationship).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Gender</label>
        <select
          value={character.gender}
          onChange={(e) => setCharacter({ ...character, gender: e.target.value })}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          {Object.values(Gender).map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Age</label>
        <input
          type="number"
          value={character.age}
          onChange={(e) => setCharacter({ ...character, age: parseInt(e.target.value) || 18 })}
          min="13"
          max="100"
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="E.g., 22" required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Personalities</label>
        <div className="mt-1 space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
          {Object.values(Personality).map(p => (
            <label key={p} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={character.personalities.includes(p)}
                onChange={() => handlePersonalityToggle(p)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{p.replace(/_/g, ' ')}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Custom Behavior (Overrides personalities)</label>
        <textarea
          value={character.customPersonality}
          onChange={(e) => setCharacter({ ...character, customPersonality: e.target.value })}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="E.g., A bubbly girl who loves memes and gets jealous easily..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Profile Pictures</label>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {character.avatars.map((avatar, index) => (
            <img
              key={index}
              src={avatar}
              alt={`Avatar ${index + 1}`}
              className={`w-16 h-16 rounded-lg object-cover cursor-pointer border-2 ${character.activeAvatarIndex === index ? 'border-blue-600' : 'border-transparent'}`}
              onClick={() => setCharacter(prev => ({ ...prev, activeAvatarIndex: index }))}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <button type="button" onClick={onCancel} className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="submit" className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Save</button>
      </div>
    </form>
  );
};

const GroupSetup = ({ characters, onSave, onCancel }) => {
  const [group, setGroup] = useState({ id: `group_${Date.now()}`, name: '', members: [], messages: [] });

  const handleMemberToggle = (characterId) => {
    setGroup(prev => {
      const members = prev.members.includes(characterId) 
        ? prev.members.filter(id => id !== characterId)
        : [...prev.members, characterId];
      return { ...prev, members };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (group.name.trim() === '') {
      alert("Please enter a name for the group.");
      return;
    }
    if (group.members.length === 0) {
      alert("Please select at least one AI profile for the group.");
      return;
    }
    onSave(group);
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 space-y-4">
      <h2 className="text-xl font-bold text-center text-gray-700">Create Group Chat</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700">Group Name</label>
        <input
          type="text"
          value={group.name}
          onChange={(e) => setGroup({ ...group, name: e.target.value })}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="E.g., Friends Group" required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Select AI Profiles</label>
        <div className="mt-1 space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
          {characters.map(char => (
            <label key={char.id} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={group.members.includes(char.id)}
                onChange={() => handleMemberToggle(char.id)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{char.name} ({char.relationship})</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <button type="button" onClick={onCancel} className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="submit" className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Create Group</button>
      </div>
    </form>
  );
};

const GroupEdit = ({ group, characters, onSave, onCancel }) => {
  const [editedGroup, setEditedGroup] = useState({ ...group });

  const handleMemberToggle = (characterId) => {
    setEditedGroup(prev => {
      const members = prev.members.includes(characterId) 
        ? prev.members.filter(id => id !== characterId)
        : [...prev.members, characterId];
      return { ...prev, members };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editedGroup.name.trim() === '') {
      alert("Please enter a name for the group.");
      return;
    }
    if (editedGroup.members.length === 0) {
      alert("Please select at least one AI profile for the group.");
      return;
    }
    onSave(editedGroup);
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 space-y-4">
      <h2 className="text-xl font-bold text-center text-gray-700">Edit Group Chat</h2>
      <div>
        <label className="block text-sm font-medium text-gray-700">Group Name</label>
        <input
          type="text"
          value={editedGroup.name}
          onChange={(e) => setEditedGroup({ ...editedGroup, name: e.target.value })}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="E.g., Friends Group" required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Members</label>
        <div className="mt-1 space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
          {characters.map(char => (
            <label key={char.id} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedGroup.members.includes(char.id)}
                onChange={() => handleMemberToggle(char.id)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{char.name} ({char.relationship})</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <button type="button" onClick={onCancel} className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
        <button type="submit" className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">Save</button>
      </div>
    </form>
  );
};

const ChatScreen = ({ character, userProfile, onCharacterUpdate, onBack, onUserProfileUpdate, backgroundUrl, onSetBackground }) => {
  const [messages, setMessages] = useState(character.messages);
  const [isTyping, setIsTyping] = useState(false);
  const [showAiProfile, setShowAiProfile] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    onCharacterUpdate({ ...character, messages });
  }, [messages, onCharacterUpdate]);

  const handleSend = useCallback(async (text) => {
    const userMessage = {
      id: `msg_${Date.now()}`,
      sender: MessageSender.USER,
      text: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messagesRef.current, userMessage];
    setMessages(updatedMessages);
    setIsTyping(true);

    const aiMessageId = `msg_${Date.now() + 1}`;
    const streamingMessage = {
      id: aiMessageId,
      sender: MessageSender.AI,
      text: '',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, streamingMessage]);

    const updateStreamingMessage = (chunk) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === aiMessageId ? { ...msg, text: msg.text + chunk } : msg
        )
      );
    };

    await generateChatResponseStream(character, userProfile, updatedMessages, userMessage, updateStreamingMessage);

    setIsTyping(false);
  }, [character, userProfile]);

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to delete all messages in this chat?")) {
      setMessages([]);
    }
  };

  const handleSaveAiProfile = (updatedCharacter) => {
    onCharacterUpdate({...updatedCharacter, messages });
    setShowAiProfile(false);
  };

  const handleSaveUserProfile = (profile) => {
    onUserProfileUpdate(profile);
    setShowUserProfile(false);
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-100">
      <ChatHeader 
        character={character} 
        onBack={onBack} 
        onEditAiProfile={() => setShowAiProfile(true)}
        onEditUserProfile={() => setShowUserProfile(true)}
        onClearChat={handleClearChat}
        onSetBackground={onSetBackground}
      />
      <MessageList 
        messages={messages} 
        character={character} 
        userProfile={userProfile} 
        isTyping={isTyping} 
        backgroundUrl={backgroundUrl}
      />
      <MessageInput onSend={handleSend} />

      {showAiProfile && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-30">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CharacterSetup
              initialCharacter={character}
              onSave={handleSaveAiProfile}
              onCancel={() => setShowAiProfile(false)}
            />
          </div>
        </div>
      )}

      {showUserProfile && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-30">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <UserProfileSetup
              userProfile={userProfile}
              onSave={handleSaveUserProfile}
              onCancel={() => setShowUserProfile(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const GroupChatScreen = ({ group, characters, userProfile, onGroupUpdate, onBack, onUserProfileUpdate, backgroundUrl, onSetBackground }) => {
  const [messages, setMessages] = useState(group.messages || []);
  const [isTyping, setIsTyping] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showGroupEdit, setShowGroupEdit] = useState(false);
  const [consecutiveSkips, setConsecutiveSkips] = useState(0);
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const groupMembers = useMemo(() => 
    group.members.map(id => characters.find(c => c.id === id)).filter(Boolean), 
    [group.members, characters]
  );

  useEffect(() => {
    onGroupUpdate({ ...group, messages });
  }, [messages, onGroupUpdate]);

  const handleSend = useCallback(async (text) => {
    setConsecutiveSkips(0);
    const userMessage = {
      id: `msg_${Date.now()}`,
      sender: MessageSender.USER,
      text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messagesRef.current, userMessage];
    setMessages(updatedMessages);
    setIsTyping(true);

    const groupStreamId = `stream_${Date.now()}`;
    const tempMessage = {
      id: groupStreamId,
      sender: 'group',
      text: '',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, tempMessage]);

    const updateStreamingMessage = (chunk) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === groupStreamId ? { ...msg, text: msg.text + chunk } : msg
        )
      );
    };

    const { fullResponse, newMessages } = await generateGroupChatResponseStream(
      groupMembers, 
      userProfile, 
      updatedMessages, 
      userMessage, 
      updateStreamingMessage,
      consecutiveSkips
    );

    setMessages(prev => {
      const withoutTemp = prev.filter(m => m.id !== groupStreamId);
      return [...withoutTemp, ...newMessages];
    });

    setIsTyping(false);
  }, [groupMembers, userProfile, consecutiveSkips]);

  const handleSkip = useCallback(async () => {
    setConsecutiveSkips(prev => prev + 1);

    let systemMessage = '[System: User skipped. Continue conversation among AI profiles.]';
    if (consecutiveSkips >= 2) {
      systemMessage = '[System: User seems unavailable or away. Continue the conversation among AI profiles without repeating the same lines or ideas. Introduce new topics or perspectives to keep it fresh and engaging.]';
    }

    setIsTyping(true);

    const groupStreamId = `stream_${Date.now()}`;
    const tempMessage = {
      id: groupStreamId,
      sender: 'group',
      text: '',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, tempMessage]);

    const updateStreamingMessage = (chunk) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === groupStreamId ? { ...msg, text: msg.text + chunk } : msg
        )
      );
    };

    const { fullResponse, newMessages } = await generateGroupChatResponseStream(
      groupMembers, 
      userProfile, 
      messagesRef.current, 
      { text: systemMessage },
      updateStreamingMessage,
      consecutiveSkips + 1
    );

    setMessages(prev => {
      const withoutTemp = prev.filter(m => m.id !== groupStreamId);
      return [...withoutTemp, ...newMessages];
    });

    setIsTyping(false);
  }, [groupMembers, userProfile, consecutiveSkips]);

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to delete all messages in this group chat?")) {
      setMessages([]);
    }
  };

  const handleSaveUserProfile = (profile) => {
    onUserProfileUpdate(profile);
    setShowUserProfile(false);
  };

  const handleSaveGroup = (updatedGroup) => {
    onGroupUpdate(updatedGroup);
    setShowGroupEdit(false);
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-100">
      <header className="bg-blue-600 text-white p-3 flex items-center shadow-md z-10 relative">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-3 flex-grow">
          <h2 className="font-semibold text-lg">{group.name}</h2>
          <p className="text-sm opacity-90">Group Chat ({groupMembers.length} members)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowGroupEdit(true)} className="p-2 text-white hover:bg-white/20 rounded">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={handleClearChat} className="p-2 text-white hover:bg-white/20 rounded">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button onClick={() => setShowUserProfile(true)} className="p-2 text-white hover:bg-white/20 rounded">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
      </header>
      <MessageList 
        messages={messages} 
        characters={characters}
        userProfile={userProfile} 
        isTyping={isTyping} 
        backgroundUrl={backgroundUrl}
        streamingText={messages.find(m => m.sender === 'group')?.text || ''}
      />
      <MessageInput onSend={handleSend} onSkip={handleSkip} />
      {showUserProfile && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-30">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <UserProfileSetup
              userProfile={userProfile}
              onSave={handleSaveUserProfile}
              onCancel={() => setShowUserProfile(false)}
            />
          </div>
        </div>
      )}
      {showGroupEdit && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-30">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <GroupEdit
              group={group}
              characters={characters}
              onSave={handleSaveGroup}
              onCancel={() => setShowGroupEdit(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const CharacterList = ({ characters, groups, onSelectCharacter, onSelectGroup, setCharacters, setGroups, setUserProfile, setChatBackground, userProfile, chatBackground }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const importInputRef = useRef(null);

  const handleSaveCharacter = (character) => {
    setCharacters(prev => [...prev, character]);
    setIsCreating(false);
  };

  const handleSaveGroup = (group) => {
    setGroups(prev => [...prev, group]);
    setIsCreatingGroup(false);
    onSelectGroup(group.id);
  };

  const handleDeleteCharacter = (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this character and all its chats?')) {
      setCharacters(prev => prev.filter(c => c.id !== id));
      setGroups(prev => prev.map(g => ({
        ...g,
        members: g.members.filter(memberId => memberId !== id)
      })));
    }
  };

  const handleDeleteGroup = (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this group and all its chats?')) {
      setGroups(prev => prev.filter(g => g.id !== id));
    }
  };

  const handleExportAll = () => {
    const allData = {
      version: '1.0',
      userProfile,
      characters,
      groups,
      chatBackground
    };
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `realchat_all_data_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.version !== '1.0') {
            alert('Invalid file format. Please use a valid RealChat data file.');
            return;
          }
          if (data.userProfile) setUserProfile(data.userProfile);
          if (data.characters) setCharacters(data.characters);
          if (data.groups) setGroups(data.groups);
          if (data.chatBackground) setChatBackground(data.chatBackground);
          alert('All data imported successfully!');
        } catch (error) {
          console.error('Import error:', error);
          alert('Failed to import data. Please check the file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleSaveUserProfile = (profile) => {
    setUserProfile(profile);
    setShowUserProfile(false);
  };

  const defaultCharacter = {
    id: `char_${Date.now()}`,
    name: '',
    relationship: Relationship.GIRLFRIEND,
    gender: Gender.FEMALE,
    age: 22,
    personalities: ['Caring', 'Understandable', 'Intelligent'],
    customPersonality: '',
    avatars: [],
    activeAvatarIndex: 0,
    messages: [],
  };

  return (
    <div className="flex flex-col h-full bg-blue-600">
      <header className="bg-blue-600 text-white p-4 pt-8">
        <h1 className="text-2xl font-bold">RealChat AI</h1>
        <p className="text-sm opacity-90">Your AI Companions</p>
        <div className="mt-2 flex justify-end space-x-2">
          <button onClick={() => setShowUserProfile(true)} className="text-white hover:underline text-sm">Edit Profile</button>
          <button onClick={handleExportAll} className="text-white hover:underline text-sm">Export All Data</button>
          <button onClick={handleImportClick} className="text-white hover:underline text-sm">Import Data</button>
          <input type="file" ref={importInputRef} accept=".json" onChange={handleImportFile} className="hidden" />
        </div>
      </header>
      <main className="flex-grow bg-white rounded-t-2xl p-4 overflow-y-auto">
        {isCreating ? (
          <CharacterSetup
            initialCharacter={defaultCharacter}
            onSave={handleSaveCharacter}
            onCancel={() => setIsCreating(false)}
          />
        ) : isCreatingGroup ? (
          <GroupSetup
            characters={characters}
            onSave={handleSaveGroup}
            onCancel={() => setIsCreatingGroup(false)}
          />
        ) : showUserProfile ? (
          <UserProfileSetup
            userProfile={userProfile}
            onSave={handleSaveUserProfile}
            onCancel={() => setShowUserProfile(false)}
          />
        ) : (
          <>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-gray-800">Characters</h2>
                <button onClick={() => setIsCreating(true)} className="text-blue-600 hover:underline text-sm">+ New</button>
              </div>
              {characters.length === 0 && (
                <div className="text-center text-gray-500 py-10">
                  <p>No companions yet.</p>
                  <p>Click "New" to start.</p>
                </div>
              )}
              <div className="space-y-3">
                {characters.map(char => (
                  <div key={char.id} onClick={() => onSelectCharacter(char.id)} className="flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors duration-200">
                    <img src={char.avatars[char.activeAvatarIndex] || `https://i.pravatar.cc/150?u=${char.id}`} alt={char.name} className="w-12 h-12 rounded-full object-cover mr-4" />
                    <div className="flex-grow overflow-hidden">
                      <h3 className="font-semibold text-gray-800">{char.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{char.relationship}</p>
                      <p className="text-xs text-gray-400 truncate">{char.messages[char.messages.length - 1]?.text || 'No messages yet'}</p>
                    </div>
                    <button onClick={(e) => handleDeleteCharacter(e, char.id)} className="ml-2 text-gray-400 hover:text-red-600 p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-red-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-gray-800">Groups</h2>
                <button onClick={() => setIsCreatingGroup(true)} className="text-blue-600 hover:underline text-sm">+ New Group</button>
              </div>
              {groups.length === 0 && (
                <div className="text-center text-gray-500 py-10">
                  <p>No groups yet.</p>
                  <p>Click "New Group" to create one.</p>
                </div>
              )}
              <div className="space-y-3">
                {groups.map(group => (
                  <div key={group.id} onClick={() => onSelectGroup(group.id)} className="flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors duration-200">
                    <div className="flex -space-x-2 mr-4">
                      {group.members.slice(0, 3).map(memberId => {
                        const char = characters.find(c => c.id === memberId);
                        return (
                          <img
                            key={memberId}
                            src={char?.avatars[char.activeAvatarIndex] || `https://i.pravatar.cc/150?u=${memberId}`}
                            alt={char?.name}
                            className="w-8 h-8 rounded-full object-cover border-2 border-white"
                          />
                        );
                      })}
                      {group.members.length > 3 && (
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">+{group.members.length - 3}</div>
                      )}
                    </div>
                    <div className="flex-grow overflow-hidden">
                      <h3 className="font-semibold text-gray-800">{group.name}</h3>
                      <p className="text-sm text-gray-500">{group.members.length} members</p>
                      <p className="text-xs text-gray-400 truncate">{group.messages[group.messages.length - 1]?.text || 'No messages yet'}</p>
                    </div>
                    <button onClick={(e) => handleDeleteGroup(e, group.id)} className="ml-2 text-gray-400 hover:text-red-600 p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-red-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

const App = () => {
  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : { id: `user_${Date.now()}`, name: '', avatar: '', age: null, gender: null };
  });
  const [characters, setCharacters] = useState(() => {
    const saved = localStorage.getItem('characters');
    return saved ? JSON.parse(saved) : [];
  });
  const [groups, setGroups] = useState(() => {
    const saved = localStorage.getItem('groups');
    return saved ? JSON.parse(saved) : [];
  });
  const [chatBackground, setChatBackground] = useState(() => localStorage.getItem('chatBackground') || null);
  const [currentChat, setCurrentChat] = useState(null);

  const [voices, setVoices] = useState([]);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => {
    if (import.meta.env.VITE_SAVE_TO_LOCAL_STORAGE === "yes") {
      const saveUserProfile = debounceSave('userProfile', userProfile);
      const saveCharacters = debounceSave('characters', characters);
      const saveGroups = debounceSave('groups', groups);
      const saveChatBackground = debounceSave('chatBackground', chatBackground);
      saveUserProfile();
      saveCharacters();
      saveGroups();
      saveChatBackground();
    }
  }, [userProfile, characters, groups, chatBackground]);

  if (!userProfile.name) {
    return (
      <UserProfileSetup
        userProfile={userProfile}
        onSave={setUserProfile}
        isInitialSetup={true}
      />
    );
  }

  const handleSelectCharacter = (id) => {
    setCurrentChat({ type: ChatType.SINGLE, id });
  };

  const handleSelectGroup = (id) => {
    setCurrentChat({ type: ChatType.GROUP, id });
  };

  const handleBack = () => {
    setCurrentChat(null);
  };

  const handleCharacterUpdate = (updatedCharacter) => {
    setCharacters(prev =>
      prev.map(c => (c.id === updatedCharacter.id ? updatedCharacter : c))
    );
  };

  const handleGroupUpdate = (updatedGroup) => {
    setGroups(prev =>
      prev.map(g => (g.id === updatedGroup.id ? updatedGroup : g))
    );
  };

  const handleSetBackground = (url) => {
    setChatBackground(url);
  };

  return (
    <div className="h-screen flex flex-col">
      {currentChat ? (
        currentChat.type === ChatType.SINGLE ? (
          <ChatScreen
            character={characters.find(c => c.id === currentChat.id)}
            userProfile={userProfile}
            onCharacterUpdate={handleCharacterUpdate}
            onBack={handleBack}
            onUserProfileUpdate={setUserProfile}
            backgroundUrl={chatBackground}
            onSetBackground={handleSetBackground}
          />
        ) : (
          <GroupChatScreen
            group={groups.find(g => g.id === currentChat.id)}
            characters={characters}
            userProfile={userProfile}
            onGroupUpdate={handleGroupUpdate}
            onBack={handleBack}
            onUserProfileUpdate={setUserProfile}
            backgroundUrl={chatBackground}
            onSetBackground={handleSetBackground}
          />
        )
      ) : (
        <CharacterList
          characters={characters}
          groups={groups}
          onSelectCharacter={handleSelectCharacter}
          onSelectGroup={handleSelectGroup}
          setCharacters={setCharacters}
          setGroups={setGroups}
          setUserProfile={setUserProfile}
          setChatBackground={setChatBackground}
          userProfile={userProfile}
          chatBackground={chatBackground}
        />
      )}
    </div>
  );
};

export default App;
