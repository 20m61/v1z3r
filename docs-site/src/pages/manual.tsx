import Layout from '@/components/Layout'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'

interface Section {
  id: string
  title: string
  content: React.ReactNode
}

const manualSections: Section[] = [
  {
    id: 'interface',
    title: 'ユーザーインターフェース',
    content: (
      <div className="space-y-6">
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">メイン画面の構成</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-vj-primary mb-2">1. ビジュアルキャンバス</h4>
              <p className="text-gray-400">画面中央の大きなエリアがビジュアル表示領域です。ここにエフェクトがリアルタイムで描画されます。</p>
            </div>
            <div>
              <h4 className="font-medium text-vj-primary mb-2">2. コントロールパネル</h4>
              <p className="text-gray-400">画面下部のパネルで、エフェクトのパラメータを調整します。タブで機能ごとに切り替えが可能です。</p>
            </div>
            <div>
              <h4 className="font-medium text-vj-primary mb-2">3. オーディオビジュアライザー</h4>
              <p className="text-gray-400">音声入力の波形とFFT解析結果をリアルタイムで表示します。</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-vj-primary/10 to-vj-secondary/10">
          <h4 className="font-medium mb-2">💡 ヒント</h4>
          <p className="text-gray-300">Hキーを押すとコントロールパネルの表示/非表示を切り替えられます。パフォーマンス中は非表示にして全画面表示を楽しめます。</p>
        </div>
      </div>
    ),
  },
  {
    id: 'audio-setup',
    title: 'オーディオ設定',
    content: (
      <div className="space-y-6">
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">音声入力の設定</h3>
          <ol className="space-y-4">
            <li>
              <strong className="text-vj-primary">1. マイク入力を有効化</strong>
              <p className="text-gray-400 mt-1">オーディオタブのマイクアイコンをクリックして、音声入力を有効にします。ブラウザの許可が必要です。</p>
            </li>
            <li>
              <strong className="text-vj-secondary">2. 入力感度の調整</strong>
              <p className="text-gray-400 mt-1">Sensitivityスライダーで入力感度を調整します。波形が適切な大きさになるよう設定してください。</p>
            </li>
            <li>
              <strong className="text-vj-accent">3. 周波数帯域の設定</strong>
              <p className="text-gray-400 mt-1">Bass、Mid、Highの各スライダーで、周波数帯域ごとの反応強度を調整できます。</p>
            </li>
          </ol>
        </div>

        <div className="card">
          <h3 className="text-xl font-semibold mb-4">外部音源の接続</h3>
          <p className="text-gray-400 mb-3">DJミキサーやオーディオインターフェースからの入力も可能です：</p>
          <ul className="space-y-2 text-gray-400">
            <li>• オーディオインターフェースをPCに接続</li>
            <li>• システム設定で入力デバイスを選択</li>
            <li>• v1z3rでマイク入力を有効化</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'effects',
    title: 'エフェクトの使い方',
    content: (
      <div className="space-y-6">
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">エフェクトの選択と調整</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">エフェクトの切り替え</h4>
              <p className="text-gray-400">Effectsタブでエフェクトタイプを選択します。数字キー(1-9)で素早く切り替えることもできます。</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">パラメータ調整</h4>
              <p className="text-gray-400">各エフェクトには複数のパラメータがあります：</p>
              <ul className="mt-2 space-y-1 text-gray-500">
                <li>• <strong>Intensity</strong>: エフェクトの強度</li>
                <li>• <strong>Speed</strong>: アニメーション速度</li>
                <li>• <strong>Color</strong>: カラーピッカーで色を選択</li>
                <li>• <strong>Scale</strong>: エフェクトのサイズ</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-xl font-semibold mb-4">オーディオリアクティブ設定</h3>
          <p className="text-gray-400 mb-3">エフェクトを音楽に反応させる方法：</p>
          <ol className="space-y-3">
            <li className="flex gap-2">
              <span className="text-vj-primary font-bold">1.</span>
              <div>
                <strong>Audio Reactivity</strong>トグルをONにする
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-vj-secondary font-bold">2.</span>
              <div>
                <strong>Frequency Range</strong>で反応する周波数帯を選択（Bass/Mid/High）
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-vj-accent font-bold">3.</span>
              <div>
                <strong>Reactivity</strong>スライダーで反応の強さを調整
              </div>
            </li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: 'layers',
    title: 'レイヤー管理',
    content: (
      <div className="space-y-6">
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">レイヤーシステムの活用</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">レイヤーの追加</h4>
              <p className="text-gray-400">Layersタブの「Add Layer」ボタンまたはCtrl+Lで新しいレイヤーを追加できます。</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">ブレンドモード</h4>
              <p className="text-gray-400">各レイヤーには20種類以上のブレンドモードがあります：</p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-500">
                <div>• Normal（通常）</div>
                <div>• Add（加算）</div>
                <div>• Multiply（乗算）</div>
                <div>• Screen（スクリーン）</div>
                <div>• Overlay（オーバーレイ）</div>
                <div>• Difference（差分）</div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">レイヤーの操作</h4>
              <ul className="space-y-1 text-gray-400">
                <li>• ドラッグ&ドロップで順序変更</li>
                <li>• 目のアイコンで表示/非表示</li>
                <li>• スライダーで透明度調整</li>
                <li>• ゴミ箱アイコンで削除</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'presets',
    title: 'プリセット管理',
    content: (
      <div className="space-y-6">
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">プリセットの保存と読み込み</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">プリセットの保存</h4>
              <ol className="space-y-2 text-gray-400">
                <li>1. 好みの設定を作成</li>
                <li>2. Ctrl+S または Save Presetボタンをクリック</li>
                <li>3. プリセット名を入力</li>
                <li>4. タグを追加（オプション）</li>
              </ol>
            </div>
            <div>
              <h4 className="font-medium mb-2">プリセットの読み込み</h4>
              <p className="text-gray-400">Presetsタブでプリセット一覧から選択、またはCtrl+Oでプリセットブラウザを開きます。</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-xl font-semibold mb-4">クラウド同期</h3>
          <p className="text-gray-400 mb-3">AWSアカウントと連携すると：</p>
          <ul className="space-y-2 text-gray-400">
            <li>• プリセットをクラウドに保存</li>
            <li>• 他のデバイスと同期</li>
            <li>• プリセットを他のユーザーと共有</li>
            <li>• バージョン管理機能</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'midi',
    title: 'MIDIコントローラー',
    content: (
      <div className="space-y-6">
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">MIDIコントローラーの接続</h3>
          <ol className="space-y-3">
            <li className="flex gap-2">
              <span className="text-vj-primary font-bold">1.</span>
              <div>
                <strong>コントローラーを接続</strong>
                <p className="text-gray-400">USBでMIDIコントローラーをPCに接続します。</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-vj-secondary font-bold">2.</span>
              <div>
                <strong>MIDIタブを開く</strong>
                <p className="text-gray-400">コントロールパネルのMIDIタブを選択します。</p>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="text-vj-accent font-bold">3.</span>
              <div>
                <strong>デバイスを選択</strong>
                <p className="text-gray-400">検出されたデバイスから使用するコントローラーを選択します。</p>
              </div>
            </li>
          </ol>
        </div>

        <div className="card">
          <h3 className="text-xl font-semibold mb-4">MIDIマッピング</h3>
          <div className="space-y-3">
            <p className="text-gray-400">以下の人気コントローラーはプリセットマッピング対応：</p>
            <ul className="space-y-2">
              <li className="text-gray-300">• Pioneer DDJ シリーズ</li>
              <li className="text-gray-300">• Novation Launchpad</li>
              <li className="text-gray-300">• Native Instruments Maschine</li>
              <li className="text-gray-300">• Ableton Push</li>
            </ul>
            <p className="text-gray-400 mt-4">カスタムマッピングも可能です。Learn機能でコントロールを割り当てられます。</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'performance',
    title: 'パフォーマンス最適化',
    content: (
      <div className="space-y-6">
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">パフォーマンス設定</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">品質設定</h4>
              <ul className="space-y-2 text-gray-400">
                <li>• <strong>Low</strong>: 低スペックPC向け（720p、30fps）</li>
                <li>• <strong>Medium</strong>: バランス重視（1080p、30fps）</li>
                <li>• <strong>High</strong>: 高品質（1080p、60fps）</li>
                <li>• <strong>Ultra</strong>: 最高品質（4K、60fps）</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">最適化のヒント</h4>
              <ul className="space-y-2 text-gray-400">
                <li>• 不要なレイヤーは削除する</li>
                <li>• パーティクル数を調整する</li>
                <li>• ポストプロセッシングを控えめに</li>
                <li>• Chrome/Edge推奨（WebGPU対応）</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-xl font-semibold mb-4">デバッグ情報</h3>
          <p className="text-gray-400 mb-3">Ctrl+Shift+Dでデバッグオーバーレイを表示：</p>
          <ul className="space-y-1 text-gray-400">
            <li>• FPS（フレームレート）</li>
            <li>• GPU使用率</li>
            <li>• メモリ使用量</li>
            <li>• レンダリング時間</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'recording',
    title: '録画と配信',
    content: (
      <div className="space-y-6">
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">パフォーマンスの録画</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">内蔵録画機能</h4>
              <p className="text-gray-400">Ctrl+Shift+Rで録画開始/停止。WebM形式で保存されます。</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">外部ソフトウェア連携</h4>
              <p className="text-gray-400">OBS Studioなどの配信ソフトウェアと連携：</p>
              <ol className="mt-2 space-y-1 text-gray-500">
                <li>1. OBSでブラウザソースを追加</li>
                <li>2. v1z3rのURLを入力</li>
                <li>3. フルスクリーンモードで実行</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-xl font-semibold mb-4">ライブ配信設定</h3>
          <ul className="space-y-2 text-gray-400">
            <li>• Syphon/Spout対応（macOS/Windows）</li>
            <li>• NDIサポート（ネットワーク経由）</li>
            <li>• 複数出力の同時送信</li>
            <li>• 低遅延モード</li>
          </ul>
        </div>
      </div>
    ),
  },
]

export default function Manual() {
  const [activeSection, setActiveSection] = useState('interface')

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-8">
            操作<span className="gradient-text">マニュアル</span>
          </h1>
          
          <p className="text-xl text-gray-400 mb-12 max-w-3xl">
            v1z3rの基本操作から高度な機能まで、詳しく解説します。
          </p>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* サイドバー */}
            <aside className="lg:w-64 flex-shrink-0">
              <div className="sticky top-24">
                <h2 className="text-lg font-semibold mb-4">目次</h2>
                <nav className="space-y-2">
                  {manualSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-all ${
                        activeSection === section.id
                          ? 'bg-vj-primary text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      {section.title}
                    </button>
                  ))}
                </nav>

                <div className="mt-8 card bg-gradient-to-br from-vj-primary/10 to-vj-accent/10">
                  <h3 className="font-semibold mb-2">クイックヘルプ</h3>
                  <p className="text-sm text-gray-300">
                    操作中に<kbd className="px-2 py-1 bg-gray-800 rounded text-xs">F1</kbd>を押すと、
                    コンテキストヘルプが表示されます。
                  </p>
                </div>
              </div>
            </aside>

            {/* メインコンテンツ */}
            <main className="flex-1 max-w-4xl">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-3xl font-bold mb-8 gradient-text">
                  {manualSections.find(s => s.id === activeSection)?.title}
                </h2>
                {manualSections.find(s => s.id === activeSection)?.content}
              </motion.div>

              {/* ナビゲーション */}
              <div className="flex justify-between mt-12">
                {manualSections.findIndex(s => s.id === activeSection) > 0 && (
                  <button
                    onClick={() => {
                      const currentIndex = manualSections.findIndex(s => s.id === activeSection)
                      setActiveSection(manualSections[currentIndex - 1].id)
                    }}
                    className="btn-secondary"
                  >
                    ← 前へ
                  </button>
                )}
                {manualSections.findIndex(s => s.id === activeSection) < manualSections.length - 1 && (
                  <button
                    onClick={() => {
                      const currentIndex = manualSections.findIndex(s => s.id === activeSection)
                      setActiveSection(manualSections[currentIndex + 1].id)
                    }}
                    className="btn-primary ml-auto"
                  >
                    次へ →
                  </button>
                )}
              </div>
            </main>
          </div>
        </motion.div>
      </div>
    </Layout>
  )
}