import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import "./StreamView.scss";

const StreamView = () => {
  return (
    <Card className="stream-view">
      {/* Placeholder for stream */}
      <div className="stream-view__content">
        <div className="stream-view__badge">
          <Badge variant="destructive" className="text-sm animate-pulse">
            🔴 LIVE
          </Badge>
        </div>
        
        <div className="stream-view__placeholder">
          <div className="stream-view__placeholder-icon">📹</div>
          <h3>Live Stream</h3>
          <p>
            Host broadcast will appear here
          </p>
          <p>
            WebRTC or HLS stream integration required for production
          </p>
        </div>
      </div>
    </Card>
  );
};

export default StreamView;
