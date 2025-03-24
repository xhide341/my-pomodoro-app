import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RoomActivity } from "server/types/room";
import { wsService } from "server/services/websocket-service";

// fetch historical activities from redis via api
const fetchActivities = async (roomId: string): Promise<RoomActivity[]> => {
  const response = await fetch(`/api/room/${roomId}/activities`);
  if (!response.ok) {
    console.error("[Activity] Failed to fetch activities");
    return [];
  }
  return response.json();
};

// store new activity in redis via api
const storeActivity = async (roomId: string, activity: RoomActivity) => {
  const response = await fetch(`/api/room/${roomId}/activities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(activity),
  });
  if (!response.ok) {
    console.error("[Activity] Failed to store activity");
    return;
  }
  return response.json();
};

// hook used by useRoom to track all room activities
export const useActivityTracker = (roomId?: string) => {
  const queryClient = useQueryClient();
  // unique key for react query cache
  const activitiesKey = ["activities", roomId];

  // fetch initial activities from redis when room is loaded
  // this gives new users the history of what happened
  const { data: activities = [] } = useQuery({
    queryKey: activitiesKey,
    queryFn: () => (roomId ? fetchActivities(roomId) : []),
    enabled: !!roomId,
  });

  // listen for real-time activities via websocket
  useEffect(() => {
    if (!roomId) return;

    // handle incoming activities from other users
    const handleActivity = (data: any) => {
      const newActivity = data.payload as RoomActivity;
      // update react query cache with new activity
      queryClient.setQueryData(activitiesKey, (prev: RoomActivity[] = []) => {
        // prevent duplicate activities
        if (prev.some((activity) => activity.id === newActivity.id))
          return prev;
        // add new activity to cache
        return [...prev, newActivity];
      });
    };

    // subscribe to websocket activities
    console.log("[useActivityTracker] Subscribing to activities...");
    wsService.subscribe("activity", handleActivity);

    // cleanup websocket subscription
    return () => {
      console.log("[useActivityTracker] Unsubscribing from activities...");
      wsService.unsubscribe("activity", handleActivity);
    };
  }, [roomId, queryClient, activitiesKey]);

  // mutation for adding new activities
  // used by useRoom to log join/leave/timer activities
  const { mutate: addActivity } = useMutation({
    mutationFn: async (activity: Omit<RoomActivity, "timeStamp" | "id">) => {
      // create new activity
      const newActivity = {
        ...activity,
        id: crypto.randomUUID(),
        timeStamp: new Date().toISOString(),
      };

      // store in redis first
      const storedActivity = await storeActivity(activity.roomId, newActivity);

      // broadcast via websocket after successful storage
      wsService.send({
        type: "activity",
        payload: storedActivity,
      });

      return storedActivity;
    },
    onSuccess: (newActivity) => {
      queryClient.setQueryData(activitiesKey, (prev: RoomActivity[] = []) => {
        if (prev.some((activity) => activity.id === newActivity.id))
          return prev;
        return [...prev, newActivity];
      });
    },
    onError: (error) => {
      console.error("[Activity] Failed to add activity:", error);
    },
  });

  return {
    activities, // historical + real-time activities
    addActivity, // function to add new activities
  };
};
