import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [currentSession, setCurrentSession] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);

  // Initialize user ID
  useEffect(() => {
    let userId = localStorage.getItem('storyCreatorUserId');
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('storyCreatorUserId', userId);
    }
  }, []);

  // Load existing sessions
  useEffect(() => {
    const loadData = () => {
      try {
        const savedData = localStorage.getItem('storyCreatorData');
        if (savedData) {
          const data = JSON.parse(savedData);
          if (data.sessions?.length > 0) {
            setCurrentSession(data.sessions[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    };
    
    loadData();
  }, []);

  const saveData = (sessions) => {
    try {
      localStorage.setItem('storyCreatorData', JSON.stringify({ sessions }));
    } catch (err) {
      console.error('Failed to save data:', err);
    }
  };

  const createNewSession = () => {
    const newSession = {
      id: Date.now().toString(),
      title: `我的故事 ${new Date().toLocaleDateString('zh-CN')}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fragments: []
    };
    
    setCurrentSession(newSession);
    saveData([newSession]);
  };

  const addFragment = async (content, inputMethod) => {
    if (!content.trim()) return;
    
    if (!currentSession) {
      createNewSession();
      return;
    }
    
    setIsLoading(true);
    
    try {
      const newFragment = {
        id: Date.now().toString(),
        content: content.trim(),
        inputMethod,
        timestamp: Date.now(),
        order: currentSession.fragments.length
      };
      
      const updatedSession = {
        ...currentSession,
        fragments: [...currentSession.fragments, newFragment],
        updatedAt: Date.now()
      };
      
      // Process story with AI (optional)
      let processedContent = content;
      if (inputMethod === 'voice') {
        try {
          const fullStory = updatedSession.fragments.map(f => f.content).join('\n\n');
          const response = await fetch('/api/process-story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullStory, newFragment: content })
          });
          
          if (response.ok) {
            const result = await response.json();
            processedContent = result.processedStory;
            // Update the fragment with processed content
            newFragment.content = processedContent;
            updatedSession.fragments[updatedSession.fragments.length - 1] = newFragment;
          }
        } catch (aiError) {
          console.warn('AI processing failed, using original content:', aiError);
        }
      }
      
      setCurrentSession(updatedSession);
      saveData([updatedSession]);
      
      if (inputMethod === 'text') {
        setTextInput('');
      }
    } catch (err) {
      console.error('添加片段失败:', err);
      setError('无法保存故事片段');
    } finally {
      setIsLoading(false);
    }
  };

  // MediaRecorder functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await sendAudioToServer(audioBlob);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        setAudioChunks([]);
        setIsRecording(false);
      };
      
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('录音启动失败:', error);
      setError('无法启动录音，请检查麦克风权限');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
    }
  };

  const sendAudioToServer = async (audioBlob) => {
    setIsLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: audioBlob
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.text) {
          addFragment(result.text, 'voice');
        } else {
          setError('语音识别失败，请重试');
        }
      } else {
        setError('语音识别服务暂时不可用');
      }
    } catch (error) {
      console.error('音频上传失败:', error);
      setError('录音上传失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim()) {
      addFragment(textInput, 'text');
    }
  };

  return (
    <>
      <Head>
        <title>小作家的故事天地</title>
        <meta name="description" content="为二年级小女生设计的故事创作助手" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app">
        <header className="app-header">
          <h1>✨ 小作家的故事天地 ✨</h1>
          <button 
            onClick={createNewSession} 
            className="new-session-btn"
            disabled={isLoading}
          >
            📝 新故事
          </button>
        </header>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <main className="main-content">
          <div className="input-section">
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`voice-button ${isRecording ? 'listening' : ''}`}
              disabled={isLoading}
            >
              {isRecording ? '🎤 停止录音' : '🎤 开始说话'}
            </button>
            
            {isRecording && <div className="listening-indicator">正在录音...</div>}
            
            <form onSubmit={handleTextSubmit} className="text-input-form">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="或者在这里输入你的故事..."
                className="text-input"
                disabled={isLoading}
              />
              <button type="submit" className="submit-btn" disabled={isLoading}>
                📤 添加到故事
              </button>
            </form>
          </div>

          {currentSession ? (
            <div className="story-display">
              <h2>{currentSession.title}</h2>
              <div className="fragments-list">
                {currentSession.fragments.map((fragment) => (
                  <div key={fragment.id} className={`fragment ${fragment.inputMethod}`}>
                    <div className="fragment-content">{fragment.content}</div>
                    <div className="fragment-meta">
                      {fragment.inputMethod === 'voice' ? '🎤' : '✍️'} 
                      {new Date(fragment.timestamp).toLocaleTimeString('zh-CN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="story-display">
              <h2>点击"新故事"开始创作吧！</h2>
              <p className="upgrade-info">
                🌟 升级版支持全平台语音输入和智能故事分析！
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}