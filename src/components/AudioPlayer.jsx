import { useEffect, useRef, useState } from "react";
import "./AudioPlayer.css";

// Radio stations configuration with multiple fallback URLs
const RADIO_STATIONS = [
  {
    id: "joe",
    name: "Joe",
    urls: [
      "https://icecast-qmusicnl-cdp.triple-it.nl/Joe_nl_high.aac?aw_0_1st.playerid=RadioNL-web&aw_0_1st.skey=1763653992&aw_0_req.userConsentV2=CQbL4QAQbL4QAGbABBNLCFFoAPLAAAAAABpYLDEBxCAUAAEAITAySJkgEIQUJgAAAgAAAAIAAiABgAoAAAQCEGESFADAAAACAAIAIAAAAABIGAAAAAAAAAABAACASAAAgAoIICAAgCAAQAAIAAAAAAAAAAAAAAACAAAAkAAAAAIIUEgAAAAAAAAAIAAAAAABAAAAAAAAAAAAAAAAgCAAAAAAAAAAAAAAABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAOEAAgEpCQDgAFgAVAA8ACAAGQAfoBEAESAO8AjgBIgCTAI9AXmAyQlAKAAWAGKARABEgDvAI4Ai8BHoC8wGSAMsHABACEAEpAWyAyYdAWAAWABUAEAAMgAxAB-gEQARIA0QB3gEWgI4AjoBIgCTAInAReAj0BMgC8wGSAMsAf2BHYoACAJSAyYpAUAAWABUAEAAMgAxAB-gEQARIA0QB3gEWgI4AjoBIgETgIvAR6AvMBkgDLAH9gR2A.ILDEBxCAUAAEAITAySJkgEIQUJgAAAgAAAAIAAiABgAoAAAQCEGESFADAAAACAAIAIAAAAABIGAAAAAAAAAABAACASAAAgAoIICAAgCAAQAAIAAAAAAAAAAAAAAACAAAAkAAAAAIIUEgAAAAAAAAAIAAAAAABAAAAAAAAAAAAAAAAgCAAAAAAAAAAAAAAABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABA.YAAAAAAAAAAA",
      "https://icecast-qmusicnl-cdp.triple-it.nl/Joe_nl_live.mp3",
      "https://21223.live.streamtheworld.com/JOE.mp3",
      "https://playerservices.streamtheworld.com/api/livestream-redirect/JOE.mp3",
      "https://icecast-qmusicnl-cdp.triple-it.nl/Qmusic_nl_live_96.mp3",
    ],
  },
  {
    id: "qmusic",
    name: "Qmusic",
    urls: [
      "https://icecast-qmusicnl-cdp.triple-it.nl/Qmusic_nl_live.mp3",
      "https://icecast-qmusicnl-cdp.triple-it.nl/Qmusic_nl_live_96.mp3",
    ],
  },
  {
    id: "radio2",
    name: "NPO Radio 2",
    urls: ["https://icecast.omroep.nl/radio2-bb-mp3"],
  },
  {
    id: "3fm",
    name: "NPO 3FM",
    urls: ["https://icecast.omroep.nl/3fm-bb-mp3"],
  },
];

const AudioPlayer = ({ onClose }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(() => {
    const savedVolume = localStorage.getItem("radio-volume");
    return savedVolume ? parseFloat(savedVolume) : 0.7;
  });
  const [error, setError] = useState(null);
  const [currentStation, setCurrentStation] = useState(() => {
    const savedStation = localStorage.getItem("radio-station");
    return savedStation || "joe";
  });

  const station =
    RADIO_STATIONS.find((s) => s.id === currentStation) || RADIO_STATIONS[0];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    localStorage.setItem("radio-station", currentStation);
  }, [currentStation]);

  const handlePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    setIsLoading(true);
    setError(null);

    // Try all available URLs for the station
    const urls = station.urls || [];
    let successfullyPlayed = false;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(
        `Attempting to play ${station.name} from URL ${i + 1}/${
          urls.length
        }: ${url}`
      );

      try {
        audio.src = url;
        await audio.play();
        setIsPlaying(true);
        successfullyPlayed = true;
        console.log(`Successfully playing ${station.name} from: ${url}`);
        break;
      } catch (err) {
        console.error(`Failed to play from URL ${i + 1}:`, err);

        // If this is the last URL, show error
        if (i === urls.length - 1) {
          setError(
            `Unable to load ${station.name}. All stream sources failed. Please try another station.`
          );
        }
      }
    }

    setIsLoading(false);
  };

  const handlePause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    localStorage.setItem("radio-volume", newVolume.toString());
  };

  const handleStationChange = (stationId) => {
    const wasPlaying = isPlaying;

    if (isPlaying) {
      handlePause();
    }

    setCurrentStation(stationId);
    setError(null);

    if (wasPlaying) {
      setTimeout(() => {
        handlePlay();
      }, 100);
    }
  };

  const handleAudioError = (e) => {
    console.error("Audio error:", e);
    setIsLoading(false);
    setIsPlaying(false);
    setError("Stream error. Please try again or select another station.");
  };

  const handleAudioLoaded = () => {
    setIsLoading(false);
  };

  return (
    <div className="audio-player">
      <audio
        ref={audioRef}
        onError={handleAudioError}
        onCanPlay={handleAudioLoaded}
        onLoadStart={() => setIsLoading(true)}
        preload="none"
      />

      <div className="audio-player-content">
        {/* Station Selector */}
        <div className="station-selector">
          <label className="station-label">Select Station:</label>
          <div className="station-buttons">
            {RADIO_STATIONS.map((s) => (
              <button
                key={s.id}
                className={`station-button ${
                  currentStation === s.id ? "active" : ""
                }`}
                onClick={() => handleStationChange(s.id)}
                disabled={isLoading}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Now Playing */}
        <div className="now-playing">
          <div className="station-info">
            <h3>{station.name}</h3>
            <p className="station-status">
              {isLoading
                ? "Connecting..."
                : isPlaying
                ? "Live"
                : "Ready to play"}
            </p>
          </div>

          {/* Equalizer Animation */}
          {isPlaying && (
            <div className="equalizer" aria-hidden="true">
              <span className="bar"></span>
              <span className="bar"></span>
              <span className="bar"></span>
              <span className="bar"></span>
              <span className="bar"></span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="player-controls">
          {/* Play/Pause Button */}
          <button
            className={`play-button ${isPlaying ? "playing" : ""}`}
            onClick={isPlaying ? handlePause : handlePlay}
            disabled={isLoading}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <svg className="spinner" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="32"
                  strokeDashoffset="32"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 12 12"
                    to="360 12 12"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            ) : isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Volume Control */}
          <div className="volume-control">
            <svg
              className="volume-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {volume > 0.5 && (
                <>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </>
              )}
              {volume > 0 && volume <= 0.5 && (
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              )}
            </svg>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="volume-slider"
              aria-label="Volume"
            />
            <span className="volume-value">{Math.round(volume * 100)}%</span>
          </div>
        </div>

        {/* Info Note */}
        <div className="player-info">
          <p>
            <strong>Note:</strong> The player tries multiple stream sources
            automatically. If {station.name} doesn't work, try selecting another
            station. Check browser console for detailed connection logs.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
