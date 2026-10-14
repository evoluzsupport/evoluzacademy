'use client';
import { useState } from 'react';
import { Robot } from './Tour';

/** The robot introduces the training video; its mouth moves while the video plays. */
export default function TrainingVideo() {
  const [playing, setPlaying] = useState(false);
  const [missing, setMissing] = useState(false);

  return (
    <div className="tv">
      <div className="tv-guide">
        <div className="lp-bubble">
          <small>Training Video</small>
          <p>
            {playing
              ? 'Sit back and watch. I will walk you through the academy.'
              : 'Press play and I will show you how Evoluz Academy works, from setup to reports.'}
          </p>
        </div>
        <Robot talking={playing} />
      </div>
      <div className="tv-player">
        {missing ? (
          <div className="tv-missing">
            <b>Training video coming soon</b>
            <span>Add the file as public/training-video.mp4 to show it here.</span>
          </div>
        ) : (
          <video
            controls
            preload="metadata"
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setMissing(true)}
          >
            <source src="/training-video.mp4" type="video/mp4" />
          </video>
        )}
      </div>
    </div>
  );
}
