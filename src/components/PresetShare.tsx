import React, { useState, useCallback, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { FaShare, FaCopy, FaDownload, FaExternalLinkAlt, FaTwitter, FaFacebook } from 'react-icons/fa';
import { Button } from '@vj-app/ui-components';

export interface PresetShareData {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  settings: Record<string, any>;
  shareUrl: string;
  createdBy?: string;
}

interface PresetShareProps {
  preset: PresetShareData;
  isOpen: boolean;
  onClose: () => void;
  onShare?: (platform: string) => void;
}

const PresetShare: React.FC<PresetShareProps> = ({
  preset,
  isOpen,
  onClose,
  onShare
}) => {
  const [copied, setCopied] = useState(false);
  const [shareMethod, setFaShareMethod] = useState<'url' | 'qr' | 'social'>('url');

  // コピー機能
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(preset.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [preset.shareUrl]);

  // Web FaShare API (モバイル対応)
  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `v1z3r Preset: ${preset.name}`,
          text: preset.description || 'Check out this VJ preset!',
          url: preset.shareUrl,
        });
        onShare?.('native');
      } catch (error) {
        console.error('Native share failed:', error);
      }
    }
  }, [preset, onShare]);

  // ソーシャル共有
  const handleSocialFaShare = useCallback((platform: string) => {
    const text = `Check out this VJ preset: ${preset.name}`;
    const url = encodeURIComponent(preset.shareUrl);
    const encodedText = encodeURIComponent(text);

    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${url}&hashtags=v1z3r,VJ,visuals`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}&summary=${encodedText}`,
      reddit: `https://reddit.com/submit?url=${url}&title=${encodedText}`,
    };

    const shareUrl = urls[platform as keyof typeof urls];
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
      onShare?.(platform);
    }
  }, [preset, onShare]);

  // QRコード用のスタイル調整
  const qrSize = 200;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-700">
        {/* ヘッダー */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">プリセット共有</h2>
            <h3 className="text-lg text-blue-300 font-medium">{preset.name}</h3>
            {preset.description && (
              <p className="text-gray-400 text-sm mt-2">{preset.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 共有方法タブ */}
        <div className="flex space-x-1 mb-6 bg-gray-800 rounded-lg p-1">
          {[
            { key: 'url', label: 'リンク', icon: FaCopy },
            { key: 'qr', label: 'QRコード', icon: FaExternalLinkAlt },
            { key: 'social', label: 'SNS', icon: FaShare },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFaShareMethod(key as any)}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md transition-colors ${
                shareMethod === key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* 共有コンテンツ */}
        <div className="space-y-4">
          {shareMethod === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  共有URL
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={preset.shareUrl}
                    readOnly
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white text-sm"
                  />
                  <Button
                    onClick={handleCopy}
                    variant={copied ? 'secondary' : 'primary'}
                    size="sm"
                    className="px-3"
                  >
                    {copied ? 'コピー済み' : 'コピー'}
                  </Button>
                </div>
              </div>

              {typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'share' in navigator && (
                <Button
                  onClick={handleNativeShare}
                  variant="outline"
                  className="w-full"
                >
                  <FaShare className="w-4 h-4 mr-2" />
                  ネイティブ共有
                </Button>
              )}
            </div>
          )}

          {shareMethod === 'qr' && (
            <div className="text-center space-y-4">
              <div className="bg-white p-4 rounded-lg inline-block">
                <QRCodeSVG
                  value={preset.shareUrl}
                  size={qrSize}
                  level="M"
                  includeMargin
                />
              </div>
              <p className="text-sm text-gray-400">
                QRコードをスキャンしてプリセットにアクセス
              </p>
              <Button
                onClick={handleCopy}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <FaCopy className="w-4 h-4 mr-2" />
                URL をコピー
              </Button>
            </div>
          )}

          {shareMethod === 'social' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleSocialFaShare('twitter')}
                  variant="outline"
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                >
                  <FaTwitter className="w-4 h-4 mr-2" />
                  FaTwitter
                </Button>
                <Button
                  onClick={() => handleSocialFaShare('facebook')}
                  variant="outline"
                  size="sm"
                  className="bg-blue-700 hover:bg-blue-800 text-white border-blue-700"
                >
                  <FaFacebook className="w-4 h-4 mr-2" />
                  FaFacebook
                </Button>
                <Button
                  onClick={() => handleSocialFaShare('linkedin')}
                  variant="outline"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                >
                  <FaExternalLinkAlt className="w-4 h-4 mr-2" />
                  LinkedIn
                </Button>
                <Button
                  onClick={() => handleSocialFaShare('reddit')}
                  variant="outline"
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                >
                  <FaShare className="w-4 h-4 mr-2" />
                  Reddit
                </Button>
              </div>
              
              <div className="pt-2 border-t border-gray-700">
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <FaCopy className="w-4 h-4 mr-2" />
                  リンクをコピー
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* プリセット情報 */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>プリセットID: {preset.id}</span>
            {preset.createdBy && (
              <span>作成者: {preset.createdBy}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresetShare;