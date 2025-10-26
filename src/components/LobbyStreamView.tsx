import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Volume2, VolumeX, RefreshCw, Radio, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";

export const LobbyStreamView = ({
  youtubeUrl = "https://www.youtube.com/embed/YDvsBbKfLPA",
  isMuted = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentMuted, setCurrentMuted] = useState<boolean>(isMuted);
  const [isPlaying, setIsPlaying] = useState(false);

  // Load YouTube API
  const loadYouTubeAPI = (): Promise<void> => {
    return new Promise((resolve) => {
      if (window.YT && window.YT.Player) return resolve();
      const existing = document.getElementById("yt-iframe-api-lobby");
      if (existing) {
        window.onYouTubeIframeAPIReady = () => resolve();
        return;
      }
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api-lobby";
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

  // Sync mute state
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

  // Initialize YouTube player
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

        if (playerRef.current) {
          try {
            playerRef.current.loadVideoById(videoId);
            if (currentMuted) playerRef.current.mute();
            else playerRef.current.unMute();

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

        const container = containerRef.current!;
        const iframeId =
          "yt-player-lobby-" + Math.random().toString(36).slice(2, 9);
        const placeholder = document.createElement("div");
        placeholder.id = iframeId;
        container
          .querySelectorAll(":scope > div.yt-placeholder-lobby")
          .forEach((n) => n.remove());
        placeholder.className = "yt-placeholder-lobby";
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
                console.log(
                  "🎬 Lobby YouTube Player Ready - Starting playback...",
                );
                if (currentMuted) event.target.mute();
                else event.target.unMute();

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

              if (evt.data === 1) {
                console.log("🎬 Lobby video started playing");
                setLoading(false);
                setIsPlaying(true);
              } else if (evt.data === 3) {
                setLoading(true);
              } else if (evt.data === 0 || evt.data === 2) {
                setIsPlaying(false);

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

  // 🚨 CRITICAL: Block ALL interactions with YouTube iframe
  useEffect(() => {
    const blockAllInteractions = () => {
      const iframes = document.querySelectorAll(".yt-placeholder-lobby iframe");
      iframes.forEach((iframe) => {
        const iframeElement = iframe as HTMLElement;
        iframeElement.style.pointerEvents = "none";
        iframeElement.style.userSelect = "none";
        iframeElement.style.webkitUserSelect = "none";
      });

      const placeholders = document.querySelectorAll(".yt-placeholder-lobby");
      placeholders.forEach((placeholder) => {
        const placeholderElement = placeholder as HTMLElement;
        placeholderElement.style.pointerEvents = "none";
        placeholderElement.style.userSelect = "none";
        placeholderElement.style.webkitUserSelect = "none";
      });
    };

    blockAllInteractions();
    const interval = setInterval(blockAllInteractions, 500);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setError(false);
    setIsPlaying(false);

    try {
      if (playerRef.current) {
        const videoId = extractVideoId(youtubeUrl);
        if (videoId) {
          playerRef.current.loadVideoById(videoId);

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
      <div className="p-4 border-b border-border bg-red-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5" />
            <h2 className="text-xl font-bold">🔴 LIVE STREAM</h2>
          </div>
          <Badge variant="secondary" className="bg-white text-red-600">
            {currentMuted ? "🔇 MUTED" : "🔊 LIVE"}
          </Badge>
        </div>
      </div>

      <div className="relative aspect-video bg-black">
        {/* Loading overlay */}
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

        {/* 🚨 CRITICAL: Blocking overlay */}
        <div
          className="absolute inset-0 z-20 bg-transparent"
          style={{
            pointerEvents: "auto",
            cursor: "not-allowed",
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("🚫 Blocked click on lobby video");
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        />

        {/* Player container - behind the blocking overlay */}
        <div ref={containerRef} className="w-full h-full relative z-10" />
      </div>
    </Card>
  );
};
