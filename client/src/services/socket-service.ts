import { io, Socket } from "socket.io-client";

export class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private currentRoom: string | null = null;
  private userName: string | null = null;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  connect(roomId: string, userName: string) {
    if (this.socket) {
      console.log("[SocketService] Already connected, disconnecting first");
      this.disconnect();
    }

    console.log(`[SocketService] Connecting to room ${roomId} as ${userName}`);

    this.socket = io();

    this.socket.on("connect", () => {
      console.log("[SocketService] Connected to server, joining room");
      this.socket?.emit("join_room", { roomId, userName });
    });

    this.socket.on("activity", (data) => {
      console.log("[SocketService] Received activity:", data.type);
      const subscribers = this.subscribers.get("activity");
      if (subscribers) {
        subscribers.forEach((callback) => callback(data));
      }
    });

    return this.socket;
  }

  subscribe(event: string, callback: Function) {
    console.log("[SocketService] Subscribing to:", event);
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)?.add(callback as (data: any) => void);
    return () => this.unsubscribe(event, callback);
  }

  unsubscribe(event: string, callback: Function) {
    console.log("[SocketService] Unsubscribing from:", event);
    this.subscribers.get(event)?.delete(callback as (data: any) => void);
  }

  emit(event: string, data: any) {
    console.log("[SocketService] Emitting event:", event, data);
    this.socket?.emit(event, data);
  }

  disconnect() {
    console.log("[SocketService] Disconnecting");
    this.socket?.disconnect();
    this.socket = null;
    this.currentRoom = null;
  }

  public getSocket() {
    return this.socket;
  }
}

// Export singleton instance
export const socketService = SocketService.getInstance();
