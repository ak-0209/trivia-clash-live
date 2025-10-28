import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Volume2, VolumeX, RefreshCw, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface StreamViewProps {
  youtubeUrl?: string;
  isMuted?: boolean;
  onMuteToggle?: (muted: boolean) => void;
  isHost?: boolean;
}

const loadYouTubeAPI = (): Promise<void> => {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve();
    const existing = document.getElementById("yt-iframe-api");
    if (existing) {
      window.onYouTubeIframeAPIReady = () => resolve();
      return;
    }
    const tag = document.createElement("script");
    tag.id = "yt-iframe-api";
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve();
  });
};

const extractVideoId = (url: string) => {
  try {
    if (!url) return "";
    if (url.includes("youtube.com/watch")) {
      const u = new URL(url);
      return u.searchParams.get("v") || "";
    }
    if (url.includes("youtu.be/")) {
      return url.split("/").pop() || "";
    }
    if (url.includes("youtube.com/embed/")) {
      const u = new URL(url);
      return u.pathname.split("/").pop() || "";
    }
    const m = url.match(/(?:v=|\/embed\/|youtu\.be\/)([^&?/]+)/);
    return m ? m[1] : "";
  } catch {
    return "";
  }
};

const StreamView = ({
  youtubeUrl = "https://www.youtube.com/embed/YDvsBbKfLPA",
  isMuted = false,
  onMuteToggle,
  isHost = false,
}: StreamViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentMuted, setCurrentMuted] = useState<boolean>(isMuted);
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync incoming prop to internal state
  useEffect(() => {
    setCurrentMuted(isMuted);
    if (playerRef.current) {
      try {
        if (isMuted) playerRef.current.mute();
        else playerRef.current.unMute();
      } catch (e) {
        console.warn("YT player mute/unmute failed", e);
      }
    }
  }, [isMuted]);

  // Create or update YT player when url changes
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      setError(false);
      setIsPlaying(false);

      const videoId = extractVideoId(youtubeUrl);
      if (!videoId) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        await loadYouTubeAPI();

        if (!mounted) return;

        // If we already have a player, load the new video and return
        if (playerRef.current) {
          try {
            playerRef.current.loadVideoById(videoId);
            if (currentMuted) playerRef.current.mute();
            else playerRef.current.unMute();

            // Force play when refreshing
            setTimeout(() => {
              if (playerRef.current && playerRef.current.playVideo) {
                playerRef.current.playVideo();
              }
            }, 1000);

            return;
          } catch (e) {
            console.warn("Failed to load new videoId on existing player:", e);
            playerRef.current.destroy();
            playerRef.current = null;
          }
        }

        // Create container if none
        const container = containerRef.current!;
        const iframeId = "yt-player-" + Math.random().toString(36).slice(2, 9);
        const placeholder = document.createElement("div");
        placeholder.id = iframeId;
        container
          .querySelectorAll(":scope > div.yt-placeholder")
          .forEach((n) => n.remove());
        placeholder.className = "yt-placeholder";
        container.appendChild(placeholder);

        playerRef.current = new window.YT.Player(iframeId, {
          height: "100%",
          width: "100%",
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            fs: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (!mounted) return;
              try {
                console.log("🎬 YouTube Player Ready - Starting playback...");
                if (currentMuted) event.target.mute();
                else event.target.unMute();

                // Force play when ready
                setTimeout(() => {
                  event.target.playVideo();
                }, 500);
              } catch (e) {
                console.warn("YT onReady play/mute error", e);
              }
            },
            onError: (e: any) => {
              if (!mounted) return;
              console.error("YT player error", e);
              setError(true);
              setLoading(false);
            },
            onStateChange: (evt: any) => {
              if (!mounted) return;

              // YT.PlayerState.PLAYING = 1
              if (evt.data === 1) {
                console.log("🎬 Video started playing");
                setLoading(false);
                setIsPlaying(true);
              }
              // YT.PlayerState.BUFFERING = 3
              else if (evt.data === 3) {
                setLoading(true);
              }
              // YT.PlayerState.ENDED = 0, PAUSED = 2
              else if (evt.data === 0 || evt.data === 2) {
                setIsPlaying(false);

                // AUTO-RESTART if paused or ended (for live streams)
                if (playerRef.current && playerRef.current.playVideo) {
                  setTimeout(() => {
                    playerRef.current.playVideo();
                  }, 1000);
                }
              }
            },
          },
        });
      } catch (err) {
        console.error("Failed to init YT player:", err);
        setError(true);
        setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      try {
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      } catch {}
    };
  }, [youtubeUrl]);

  // 🚨 CRITICAL FIX: Block ALL interactions with YouTube iframe
  useEffect(() => {
    const blockAllInteractions = () => {
      // Block pointer events on iframe
      const iframes = document.querySelectorAll(".yt-placeholder iframe");
      iframes.forEach((iframe) => {
        const iframeElement = iframe as HTMLElement;
        iframeElement.style.pointerEvents = "none";
        iframeElement.style.userSelect = "none";
        iframeElement.style.webkitUserSelect = "none";
      });

      // Also block any parent containers
      const placeholders = document.querySelectorAll(".yt-placeholder");
      placeholders.forEach((placeholder) => {
        const placeholderElement = placeholder as HTMLElement;
        placeholderElement.style.pointerEvents = "none";
        placeholderElement.style.userSelect = "none";
        placeholderElement.style.webkitUserSelect = "none";
      });
    };

    blockAllInteractions();
    const interval = setInterval(blockAllInteractions, 500); // More frequent checking

    return () => clearInterval(interval);
  }, []);

  const handleHostMuteToggle = () => {
    const next = !currentMuted;
    setCurrentMuted(next);
    if (playerRef.current) {
      try {
        if (next) playerRef.current.mute();
        else playerRef.current.unMute();
      } catch (e) {
        console.warn("mute toggle failed:", e);
      }
    }
    if (onMuteToggle) onMuteToggle(next);
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(false);
    setIsPlaying(false);

    try {
      if (playerRef.current) {
        const videoId = extractVideoId(youtubeUrl);
        if (videoId) {
          playerRef.current.loadVideoById(videoId);

          // Force play after refresh
          setTimeout(() => {
            if (playerRef.current && playerRef.current.playVideo) {
              playerRef.current.playVideo();
            }
          }, 1000);
        }
      }
    } catch (e) {
      console.warn("Refresh failed, recreating player", e);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
          playerRef.current = null;
        } catch {}
      }
      setLoading(true);
    }
  };

  return (
    <Card className="glass-panel overflow-hidden border-2 border-red-500">
      <div className="p-4 border-b border-border bg-white-600 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 animate-pulse" />
            <h2 className="text-2xl leaguegothic">🔴 LIVE STREAM</h2>
          </div>
          <div className="flex items-center gap-2">
            {isHost && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleHostMuteToggle}
                className="glassmorphism-light flex items-center gap-2 text-white"
              >
                {currentMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
                {currentMuted ? "Unmute All" : "Mute All"}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              className="glassmorphism-light flex items-center gap-2 text-white"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="relative bg-black" style={{height:"400px"}}>
        {/* Loading overlay - only show if loading AND not playing */}
        {loading && !isPlaying && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 text-white">
            <div className="text-center">
              <Radio className="w-8 h-8 animate-pulse text-red-500 mx-auto mb-2" />
              <div className="mb-2">Loading Live Stream...</div>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black text-white">
            <div className="text-center">
              <div className="text-red-400 mb-4">
                ❌ Failed to load live stream
              </div>
              <Button onClick={handleRefresh} variant="destructive">
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* 🚨 CRITICAL: Add a blocking overlay that covers the entire video area */}
        <div
          className="absolute inset-0 z-20 bg-transparent"
          style={{
            pointerEvents: "auto",
            cursor: "not-allowed",
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("🚫 Blocked click on video");
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        />

        {/* Player container - behind the blocking overlay */}
        <div ref={containerRef} className="w-full h-full relative z-10" />
      </div>

      <div className="p-3 bg-white-500 text-white border-t border-white-600">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white text-red-600">
              {loading ? "LOADING..." : error ? "❌ OFFLINE" : "🔴 LIVE"}
            </Badge>
            <span className="text-white/80">
              {isHost ? "HOST STREAM" : "WATCHING LIVE"}
            </span>
          </div>
          <span className="text-white/80">
            {currentMuted ? "🔇 MUTED" : "🔊 LIVE AUDIO"}
          </span>
        </div>
      </div>
    </Card>
  );
};

export default StreamView;
