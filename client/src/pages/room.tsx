import { useParams } from "react-router-dom";
import { useUserInfo } from "../contexts/user-context";
import { useEffect, useState } from "react";
import { useRoom } from "../hooks/use-room";
import { RoomActivity } from "server/types/room";

import { Clock } from "../components/clock";
import { Header } from "../components/header";
import { ActivityLog } from "../components/activity-log";
import { UserDisplay } from "../components/user-display";
import { UserModal } from "../components/user-modal";

export const RoomPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { activities, addActivity, joinRoom, leaveRoom } = useRoom(roomId);
  const { userName, setUserName } = useUserInfo();
  const [showModal, setShowModal] = useState(!userName);

  // get latest timer-related activity and sort by timestamp
  const latestTimerActivity = activities.length
    ? activities
        .filter((activity: RoomActivity) =>
          [
            "start_timer",
            "pause_timer",
            "change_timer",
            "reset_timer",
          ].includes(activity.type),
        )
        .sort(
          (a, b) =>
            new Date(b.timeStamp).getTime() - new Date(a.timeStamp).getTime(),
        )[0]
    : null;

  useEffect(() => {
    if (!roomId) return;
    return () => {
      const handleLeave = async () => {
        if (userName && roomId) {
          await leaveRoom(roomId, userName);
        }
      };
      handleLeave();
    };
  }, [userName, roomId]);

  const handleJoin = async (name: string) => {
    if (!roomId) return;
    // setUserName(name);
    await joinRoom(roomId, name);
    setShowModal(false);
  };

  const handleSkip = async (name: string) => {
    if (!roomId) return;
    // do not set localstorage username for skipped
    await joinRoom(roomId, name);
    setShowModal(false);
  };

  return (
    <div className="font-roboto relative mx-auto flex h-dvh max-h-dvh w-full max-w-2xl flex-col bg-[var(--color-background)] p-4 text-[var(--color-foreground)]">
      <UserModal isOpen={showModal} onJoin={handleJoin} onSkip={handleSkip} />
      <Header />
      <div className="mx-auto flex w-full max-w-3xl flex-col">
        <Clock addActivity={addActivity} latestActivity={latestTimerActivity} />
      </div>
      <div className="mt-4">
        {roomId && <ActivityLog activities={activities} />}
      </div>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2">
        <UserDisplay activities={activities} />
      </div>
    </div>
  );
};
