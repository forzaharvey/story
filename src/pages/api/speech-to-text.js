// Vercel Serverless Function for speech-to-text conversion
import { createReadStream } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import fetch from 'node-fetch';

const pump = promisify(pipeline);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get audio data from request
    const audioBuffer = req.body;
    
    // Call Alibaba Cloud Bailian Fun-ASR API
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/transcription', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'fun-asr-realtime',
        input: {
          audio_content: audioBuffer.toString('base64')
        }
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      res.status(200).json({
        text: result.output.text,
        success: true
      });
    } else {
      console.error('Fun-ASR API error:', result);
      res.status(500).json({
        error: 'Speech recognition failed',
        success: false
      });
    }
  } catch (error) {
    console.error('Speech-to-text error:', error);
    res.status(500).json({
      error: 'Internal server error',
      success: false
    });
  }
}

// Handle file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
};