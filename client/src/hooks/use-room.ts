import { useState, useEffect, useRef } from "react";
import { RoomInfo, RoomUser } from "server/types/room";
import { useActivityTracker } from "./use-activity-tracker";
import { useUserInfo } from "../contexts/user-context";

export const useRoom = (roomId?: string) => {
  const { userName } = useUserInfo();
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [roomUsers, setRoomUsers] = useState<RoomUser[]>([]);
  // get activities from activity tracker
  const { activities: trackerActivities, addActivity } = useActivityTracker(
    roomId,
    userName,
  );

  // tracker for room initialization
  // will trigger on roomId and userName changes
  useEffect(() => {
    if (!roomId) return;

    console.log("[useRoom] Initializing room:", roomId);
    const initRoom = async () => {
      try {
        // get room metadata
        const room = await fetchRoom(roomId);
        if (room) {
          setRoomInfo(room);
        }
        // fetch users
        const users = await fetchRoomUsers(roomId);
        console.log("[initRoom] Fetched users:", users);
        if (users) {
          setRoomUsers(users);
          console.log("[initRoom] Set roomUsers: ", users);
        } else {
          console.log("[initRoom] No users fetched or fetch failed");
        }
      } catch (error) {
        console.error("[initRoom] Error initializing room:", error);
      }
    };

    initRoom();
  }, [roomId, userName]); //retrigger on these changes

  // tracker for join/leave activities
  // this will update the user list in real time
  useEffect(() => {
    if (!roomId || !trackerActivities.length) return;

    // reference to track the last processed activity
    const lastProcessedRef = useRef<string | null>(null);

    // find the most recent join/leave activity
    const joinLeaveActivities = trackerActivities.filter(
      (a) => a.type === "join" || a.type === "leave",
    );

    if (joinLeaveActivities.length === 0) return;

    // create a unique identifier for the latest activity
    const latestActivity = joinLeaveActivities[joinLeaveActivities.length - 1];
    const activityKey = `${latestActivity.type}-${latestActivity.userName}-${latestActivity.timeStamp}`;

    // only refetch if this is a new activity
    if (activityKey !== lastProcessedRef.current) {
      console.log(
        "[useRoom] New join/leave activity detected, refreshing users",
      );
      // update reference
      lastProcessedRef.current = activityKey;

      // refetch users
      fetchRoomUsers(roomId).then((users) => {
        if (users) setRoomUsers(users);
      });
    }
  }, [trackerActivities, roomId]);

  // room functions
  const fetchRoom = async (roomId: string): Promise<RoomInfo | null> => {
    try {
      const response = await fetch(`/api/room/${roomId}/info`);

      if (!response.ok) {
        // handle non-200 responses properly
        if (response.status === 404) return null;
        console.error(`[useRoom] Server error: ${response.status}`);
        return null;
      }

      // check for empty response
      const text = await response.text();
      if (!text || text.trim() === "") {
        console.error("[useRoom] Empty response from server");
        return null;
      }

      return JSON.parse(text);
    } catch (error) {
      console.error("[useRoom] Error fetching room:", error);
      return null;
    }
  };

  const fetchRoomUsers = async (roomId: string) => {
    try {
      const response = await fetch(`/api/room/${roomId}/users`);
      if (!response.ok) {
        console.error(
          `[useRoom] Failed to fetch users: ${response.status} ${response.statusText}`,
        );
        return null;
      }
      const usersData = await response.json();
      return usersData;
    } catch (error) {
      console.error("[useRoom] Error fetching room users:", error);
      return null;
    }
  };

  const createRoom = async (roomId: string) => {
    try {
      const response = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });

      // better error handling
      if (!response.ok) {
        console.error(`[useRoom] Failed to create room: ${response.status}`);
        return null;
      }

      // check for empty response
      const text = await response.text();
      if (!text || text.trim() === "") {
        console.error("[useRoom] Empty response from create room");
        return null;
      }

      const data = JSON.parse(text);
      console.log("[useRoom] Created room:", data);
      setRoomInfo(data);
      return data;
    } catch (error) {
      console.error("[useRoom] Error creating room:", error);
      return null;
    }
  };

  const joinRoom = async (roomId: string, userName: string = "user") => {
    try {
      const response = await fetch(`/api/room/${roomId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (!data) return null;

      // always add join activity regardless of modal skip
      addActivity({
        type: "join",
        userName,
        roomId,
      });

      setRoomInfo((prev) => ({
        ...prev!,
        activeUsers: data.userCount,
        lastActive: data.lastActive,
      }));

      return data;
    } catch (error) {
      console.error("[useRoom] Error joining room:", error);
      return null;
    }
  };

  const leaveRoom = async (roomId: string, userName: string) => {
    try {
      const response = await fetch(`/api/room/${roomId}/users`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName }),
      });
      if (!response.ok) {
        console.error("[useRoom] Failed to leave room");
        return;
      }
      const data = await response.json();
      if (!data || !roomInfo) return;

      // add leave activity
      addActivity({
        type: "leave",
        userName,
        roomId,
      });
      setRoomInfo({
        ...roomInfo,
        activeUsers: data.userCount,
        lastActive: data.lastActive,
      });

      return data;
    } catch (error) {
      console.error(error);
    }
  };

  const shareRoom = async (roomId: string) => {
    try {
      const url = window.location.href;

      // store url in redis
      const response = await fetch(`/api/room/${roomId}/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        console.error("[useRoom] Failed to store shareable URL");
        return null;
      }

      // copy to clipboard
      await navigator.clipboard.writeText(url);
      return url;
    } catch (error) {
      console.error("[useRoom] Error sharing room:", error);
      return null;
    }
  };

  const getRoomUrl = async (roomId: string) => {
    try {
      const response = await fetch(`/api/room/${roomId}/url`);
      if (!response.ok) {
        console.error("[useRoom] Failed to get shareable URL");
        return null;
      }
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error("[useRoom] Error getting room URL:", error);
      return null;
    }
  };

  return {
    roomInfo,
    roomUsers,
    activities: trackerActivities,
    addActivity,
    fetchRoom,
    createRoom,
    joinRoom,
    leaveRoom,
    fetchRoomUsers,
    shareRoom,
    getRoomUrl,
  };
};

export default useRoom;
