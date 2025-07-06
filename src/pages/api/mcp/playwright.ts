import { NextApiRequest, NextApiResponse } from 'next'

interface PlaywrightTestResult {
  status: 'success' | 'error'
  results?: {
    passed: number
    failed: number
    skipped: number
    total: number
    duration: number
  }
  error?: string
  message?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PlaywrightTestResult>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      status: 'error',
      error: 'Method not allowed' 
    })
  }

  const { action, testPattern } = req.body

  if (!action) {
    return res.status(400).json({ 
      status: 'error',
      error: 'Missing required parameter: action' 
    })
  }

  try {
    // シミュレートされたPlaywrightテスト実行
    // 実際の実装では、ここでPlaywrightテストを実行します
    
    if (action === 'run-tests') {
      // テスト実行のシミュレーション
      const mockResults = {
        passed: 12,
        failed: 0,
        skipped: 2,
        total: 14,
        duration: 15432 // ミリ秒
      }

      return res.status(200).json({
        status: 'success',
        results: mockResults,
        message: `Playwright tests completed. Pattern: ${testPattern || 'all'}`
      })
    }

    if (action === 'health-check') {
      // Playwrightの健康状態チェック
      return res.status(200).json({
        status: 'success',
        message: 'Playwright MCP server is running'
      })
    }

    return res.status(400).json({
      status: 'error',
      error: `Unknown action: ${action}`
    })

  } catch (error) {
    console.error('Playwright MCP error:', error)
    return res.status(500).json({
      status: 'error',
      error: 'Internal server error while executing Playwright action'
    })
  }
}