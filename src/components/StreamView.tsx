import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const StreamView = () => {
  return (
    <Card className="glass-panel p-0 overflow-hidden relative aspect-video">
      {/* Placeholder for stream */}
      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center relative">
        <div className="absolute top-4 left-4">
          <Badge variant="destructive" className="text-sm animate-pulse">
            🔴 LIVE
          </Badge>
        </div>
        
        <div className="text-center">
          <div className="text-6xl mb-4">📹</div>
          <h3 className="text-2xl font-bold mb-2">Live Stream</h3>
          <p className="text-muted-foreground">
            Host broadcast will appear here
          </p>
          <p className="text-sm text-muted-foreground mt-4 max-w-md mx-auto px-4">
            WebRTC or HLS stream integration required for production
          </p>
        </div>
      </div>
    </Card>
  );
};

export default StreamView;
