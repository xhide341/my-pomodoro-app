import { useState, useEffect } from "react";
import { useQuote } from "../hooks/use-quote";
import { useParams, useNavigate } from "react-router-dom";
import { RoomActivity } from "server/types/room";
import { useUserInfo } from "../contexts/user-context";

import { Play, Pause, RotateCcw } from "react-feather";
import { Navigation } from "./navigation";
import { ProgressBar } from "./progress-bar";

type TimerMode = "work" | "break";

// TODO: Fix progress bar length relying on quote length

export const Clock = ({
  addActivity,
  latestActivity,
}: {
  addActivity: (activity: Omit<RoomActivity, "id" | "timeStamp">) => void;
  latestActivity: RoomActivity | null;
}) => {
  const { roomId } = useParams<{ roomId: string }>();
  const { userName } = useUserInfo();

  const [time, setTime] = useState("25:00");
  const [lastWorkTime, setLastWorkTime] = useState("25:00");
  const [lastBreakTime, setLastBreakTime] = useState("05:00");
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<TimerMode>("work");
  const [isSync, setIsSync] = useState(false);
  const { quote, author } = useQuote();
  const navigate = useNavigate();

  if (!roomId) {
    navigate("/session");
    return null;
  }

  const handleTimerChange = (
    minutes: number,
    mode: TimerMode,
    isSync: boolean = false,
  ) => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    const newTime = `${String(minutes).padStart(2, "0")}:00`;
    setTimerMode(mode);
    if (mode === "work") {
      setLastWorkTime(newTime);
    } else {
      setLastBreakTime(newTime);
    }
    setTime(newTime);
    setIsRunning(false);

    if (!isSync) {
      addActivity({
        type: "change_timer",
        userName: userName,
        roomId: roomId,
        timeRemaining: newTime,
        timerMode: mode,
      });
    }
  };

  const handleStart = (isSync: boolean = false) => {
    if (timerInterval) return;

    const startTime = Date.now();
    const [min, sec] = time.split(":").map(Number);
    const totalSeconds = min * 60 + sec;

    if (totalSeconds <= 0) {
      const resetTime = timerMode === "work" ? lastWorkTime : lastBreakTime;
      setTime(resetTime);
      return;
    }

    const newInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, totalSeconds - elapsed);

      const newMinutes = Math.floor(remaining / 60);
      const newSeconds = remaining % 60;

      const newTime = `${String(newMinutes).padStart(2, "0")}:${String(newSeconds).padStart(2, "0")}`;
      setTime(newTime);

      if (remaining <= 0) {
        clearInterval(newInterval);
        setTimerInterval(null);
        setIsRunning(false);

        if (!isSync && newTime === "00:00") {
          addActivity({
            type: "complete_timer",
            userName: userName,
            roomId: roomId,
            timeRemaining: "00:00",
            timerMode: timerMode,
          });
        }
        return;
      }
    }, 100);

    setIsRunning(true);
    setTimerInterval(newInterval);

    if (!isSync) {
      addActivity({
        type: "start_timer",
        userName: userName,
        roomId: roomId,
        timeRemaining: time,
        timerMode: timerMode,
      });
    }
  };

  const handlePause = (isSync: boolean = false) => {
    if (timerInterval && isRunning) {
      clearInterval(timerInterval);
      setTimerInterval(null);
      setIsRunning(false);

      if (!isSync) {
        addActivity({
          type: "pause_timer",
          userName: userName,
          roomId: roomId,
          timeRemaining: time,
          timerMode: timerMode,
        });
      }
    }
  };

  const handleReset = (isSync: boolean = false) => {
    if (timerInterval && isRunning) {
      clearInterval(timerInterval);
      setTimerInterval(null);

      if (!isSync) {
        addActivity({
          type: "reset_timer",
          userName: userName,
          roomId: roomId,
          timeRemaining: time,
          timerMode: timerMode,
        });
      }
    }
    setTime(timerMode === "work" ? lastWorkTime : lastBreakTime);
    setIsRunning(false);
  };

  useEffect(() => {
    if (!roomId || !latestActivity) return;

    const handleTimerSync = (activity: RoomActivity) => {
      const [currentMin, currentSec] = time.split(":").map(Number);
      const [activityMin, activitySec] = (activity.timeRemaining || "00:00")
        .split(":")
        .map(Number);
      const currentTotalSeconds = currentMin * 60 + currentSec;
      const activityTotalSeconds = activityMin * 60 + activitySec;

      const needsSync =
        !isRunning ||
        Math.abs(currentTotalSeconds - activityTotalSeconds) > 2 ||
        timerMode !== activity.timerMode;

      // Always process timer changes
      if (activity.type === "change_timer") {
        const minutes = parseInt(activity.timeRemaining?.split(":")[0] || "25");
        handleTimerChange(minutes, activity.timerMode || "work", true);
        return;
      }

      // Rest of sync logic for other activities
      if (
        !needsSync &&
        activity.type !== "pause_timer" &&
        activity.type !== "reset_timer"
      )
        return;

      setIsSync(true);
      if (activity.type === "pause_timer") {
        setTime(activity.timeRemaining || time);
        handlePause(true);
      }
      if (activity.type === "start_timer") {
        setTime(activity.timeRemaining || time);
        setTimerMode(activity.timerMode || "work");
        handleStart(true);
      }
      if (activity.type === "reset_timer") {
        handleReset(true);
      }
      setIsSync(false);
    };

    handleTimerSync(latestActivity);
  }, [roomId, latestActivity]);

  return (
    <div
      className={`${
        timerMode === "work" ? "bg-secondary" : "bg-secondary/80"
      } flex flex-col items-center justify-center rounded-xl p-10`}
    >
      <Navigation onTimerChange={handleTimerChange} />
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-[8rem] font-bold">{time}</h1>
        <div className="flex flex-row justify-center gap-4 text-center text-2xl">
          <button
            aria-label={isRunning ? "Pause" : "Start"}
            className={`css-button-3d w-24 p-4 ${isRunning ? "pressed" : ""}`}
            onClick={
              isRunning ? () => handlePause(false) : () => handleStart(false)
            }
          >
            {isRunning ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <button
            aria-label="Reset"
            className="css-button-3d w-24 p-4"
            onClick={() => handleReset(false)}
          >
            <RotateCcw size={24} />
          </button>
        </div>
        <div className="mt-12 w-full">
          <ProgressBar
            currentTime={time}
            totalTime={timerMode === "work" ? lastWorkTime : lastBreakTime}
          />
        </div>
        <div className="mt-12 flex flex-col items-center justify-center gap-1">
          <blockquote className="font-base text-sm">"{quote}"</blockquote>
          <p className="text-sm italic">{author}</p>
        </div>
      </div>
    </div>
  );
};

export default Clock;
