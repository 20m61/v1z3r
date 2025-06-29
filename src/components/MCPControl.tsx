import React, { useState } from 'react';
import Button from './ui/Button';

interface MCPResult {
  content?: string;
  error?: string;
  metadata?: any;
}

const MCPControl: React.FC = () => {
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubPath, setGithubPath] = useState('');
  const [playwrightUrl, setPlaywrightUrl] = useState('');
  const [result, setResult] = useState<MCPResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'github' | 'playwright'>('github');

  const handleGitHubFetch = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const params = new URLSearchParams();
      params.append('owner', githubOwner);
      params.append('repo', githubRepo);
      if (githubPath.trim()) {
        params.append('path', githubPath);
      }
      
      const response = await fetch(`/api/mcp/github?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        setResult({ error: data.error || `HTTP ${response.status}` });
      } else {
        setResult(data);
      }
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handlePlaywrightFetch = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const response = await fetch(`/api/mcp/playwright?url=${encodeURIComponent(playwrightUrl)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        setResult({ error: errorData.error || `HTTP ${response.status}` });
      } else {
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          const data = await response.json();
          setResult(data);
        } else {
          const text = await response.text();
          setResult({ 
            content: text,
            metadata: { 
              url: playwrightUrl, 
              contentType,
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Network error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const clearResult = () => {
    setResult(null);
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="space-y-4 p-4 bg-gray-900 rounded-lg">
      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-gray-700">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'github'
              ? 'text-v1z3r-primary border-b-2 border-v1z3r-primary'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('github')}
        >
          GitHub
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'playwright'
              ? 'text-v1z3r-primary border-b-2 border-v1z3r-primary'
              : 'text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => setActiveTab('playwright')}
        >
          Playwright
        </button>
      </div>

      {/* GitHub Tab */}
      {activeTab === 'github' && (
        <div>
          <h3 className="text-lg font-bold mb-3 text-v1z3r-primary">GitHub Repository Browser</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={githubOwner}
                onChange={(e) => setGithubOwner(e.target.value.trim())}
                placeholder="Repository Owner"
                className="p-3 bg-gray-800 border border-gray-700 rounded focus:border-v1z3r-primary focus:ring-1 focus:ring-v1z3r-primary"
              />
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value.trim())}
                placeholder="Repository Name"
                className="p-3 bg-gray-800 border border-gray-700 rounded focus:border-v1z3r-primary focus:ring-1 focus:ring-v1z3r-primary"
              />
            </div>
            <input
              type="text"
              value={githubPath}
              onChange={(e) => setGithubPath(e.target.value)}
              placeholder="File Path (optional)"
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded focus:border-v1z3r-primary focus:ring-1 focus:ring-v1z3r-primary"
            />
            <div className="flex gap-2">
              <Button 
                onClick={handleGitHubFetch} 
                disabled={loading || !githubOwner.trim() || !githubRepo.trim()}
                variant="primary"
              >
                {loading ? 'Fetching...' : 'Fetch Content'}
              </Button>
              {result && (
                <Button onClick={clearResult} variant="secondary">
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Playwright Tab */}
      {activeTab === 'playwright' && (
        <div>
          <h3 className="text-lg font-bold mb-3 text-v1z3r-primary">Web Page Scraper</h3>
          <div className="space-y-3">
            <input
              type="url"
              value={playwrightUrl}
              onChange={(e) => setPlaywrightUrl(e.target.value.trim())}
              placeholder="https://example.com"
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded focus:border-v1z3r-primary focus:ring-1 focus:ring-v1z3r-primary"
            />
            <div className="flex gap-2">
              <Button 
                onClick={handlePlaywrightFetch} 
                disabled={loading || !playwrightUrl.trim() || !isValidUrl(playwrightUrl)}
                variant="primary"
              >
                {loading ? 'Fetching...' : 'Fetch Page'}
              </Button>
              {result && (
                <Button onClick={clearResult} variant="secondary">
                  Clear
                </Button>
              )}
            </div>
            {playwrightUrl.trim() && !isValidUrl(playwrightUrl) && (
              <p className="text-red-400 text-sm">Please enter a valid URL</p>
            )}
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-bold text-v1z3r-primary">Result</h3>
            {result.metadata && (
              <div className="text-sm text-gray-400">
                {result.metadata.size && `Size: ${result.metadata.size} bytes`}
                {result.metadata.timestamp && ` • ${new Date(result.metadata.timestamp).toLocaleTimeString()}`}
              </div>
            )}
          </div>
          
          {result.error ? (
            <div className="bg-red-900 border border-red-700 p-4 rounded">
              <p className="text-red-200 font-medium">Error:</p>
              <p className="text-red-300">{result.error}</p>
            </div>
          ) : (
            <div className="bg-gray-800 border border-gray-700 rounded">
              <div className="p-3 border-b border-gray-700 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-300">Content</span>
                <button
                  onClick={() => navigator.clipboard.writeText(result.content || '')}
                  className="text-xs text-v1z3r-primary hover:text-v1z3r-light"
                >
                  Copy
                </button>
              </div>
              <pre className="p-4 overflow-auto max-h-96 text-sm text-gray-200 leading-relaxed">
                {result.content}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MCPControl;
