import { X, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark as oneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useUIStore } from '../../store/uiState';

export function CodeWindow() {
  const { missionCodeFiles, toggleCodeWindow, codeWindowOpen } = useUIStore();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Auto-select the first file or switch to newest
  useEffect(() => {
    const fileNames = Object.keys(missionCodeFiles);
    if (fileNames.length > 0) {
      // Switch to newest file if we don't have a selection or selection was deleted
      if (!selectedFile || !missionCodeFiles[selectedFile]) {
        setSelectedFile(fileNames[fileNames.length - 1]);
      }
    } else {
      setSelectedFile(null);
    }
  }, [missionCodeFiles, selectedFile]);

  if (!codeWindowOpen) {
    return null;
  }

  const fileNames = Object.keys(missionCodeFiles);
  const currentFile = selectedFile ? missionCodeFiles[selectedFile] : null;

  return (
    <div className="flex flex-col h-full bg-command-panel border-l border-command-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-command-border bg-gray-900/50">
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-hud-green" />
          <h2 className="text-sm font-mono font-bold text-hud-green uppercase tracking-wider">Live Code</h2>
        </div>
        <button
          onClick={() => toggleCodeWindow()}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
          aria-label="Close code window"
        >
          <X className="w-4 h-4 text-gray-400 hover:text-gray-200" />
        </button>
      </div>

      {/* File Tabs */}
      {fileNames.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-command-border bg-gray-900/30 overflow-x-auto">
          {fileNames.map((fileName) => (
            <button
              key={fileName}
              onClick={() => setSelectedFile(fileName)}
              className={`px-3 py-1.5 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                selectedFile === fileName
                  ? 'bg-hud-green/20 border border-hud-green/50 text-hud-green'
                  : 'bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {fileName}
            </button>
          ))}
        </div>
      )}

      {/* Code Display */}
      <div className="flex-1 overflow-hidden">
        {currentFile ? (
          <div className="h-full overflow-auto">
            <div className="px-4 py-2 text-[10px] text-gray-500 border-b border-command-border bg-gray-900/30">
              <span className="text-hud-blue">{currentFile.subtaskTitle}</span> • <span className="text-gray-600">{currentFile.language}</span>
            </div>
            <SyntaxHighlighter
              language={currentFile.language.toLowerCase()}
              style={oneDark as Record<string, Record<string, string>>}
              customStyle={{
                margin: 0,
                padding: '16px',
                fontSize: '12px',
                fontFamily: 'Fira Code, Courier New, monospace',
                lineHeight: '1.5',
                backgroundColor: 'transparent',
              }}
              showLineNumbers={true}
              wrapLines={true}
              lineNumberStyle={{
                color: '#6B7280',
                paddingRight: '16px',
              }}
            >
              {currentFile.code}
            </SyntaxHighlighter>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <p className="text-sm">Waiting for mission output…</p>
          </div>
        )}
      </div>
    </div>
  );
}
