// Vercel Serverless Function for story logic analysis and conflict detection
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fullStory, newFragment } = req.body;
    
    // Create prompt for Qwen3-Max
    const systemPrompt = `你是一个温柔可爱的儿童故事老师。现在有一个二年级的小女孩正在一段一段地讲故事。
你的任务是：
1. 记住前文的情节。
2. 检查她刚输入的最新片段，与前文是否存在明显的逻辑冲突（比如人物位置瞬间转移、时间线错乱等）。
3. 如果有冲突：请用极其温柔、鼓励的口吻提问，引导她修正。例如：'哎呀，宝贝，刚才小猫不是在森林里吗，怎么突然跑到深海里啦？'
4. 如果没有冲突：请将新片段顺滑地润色并拼接到前文中，返回一个更丰富的故事文本。语言要充满童趣。`;

    const userMessage = `已有故事全文：
${fullStory}

新片段：
${newFragment}`;

    // Call Qwen3-Max API
    const response = await fetch('https://coding.dashscope.aliyuncs.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen3-max-2026-01-23',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const result = await response.json();
    
    if (response.ok && result.choices?.[0]?.message?.content) {
      res.status(200).json({
        processedStory: result.choices[0].message.content,
        success: true
      });
    } else {
      console.error('Qwen3-Max API error:', result);
      // Fallback to simple concatenation
      res.status(200).json({
        processedStory: `${fullStory}\n\n${newFragment}`,
        success: true,
        fallback: true
      });
    }
  } catch (error) {
    console.error('Process story error:', error);
    // Fallback to simple concatenation
    const { fullStory, newFragment } = req.body;
    res.status(200).json({
      processedStory: `${fullStory}\n\n${newFragment}`,
      success: true,
      fallback: true
    });
  }
}