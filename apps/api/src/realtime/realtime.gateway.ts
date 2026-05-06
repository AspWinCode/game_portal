import { Injectable } from "@nestjs/common";
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { RealtimeEvent, SessionSnapshotRealtimePayload } from "@game-game/shared";
import type { Socket, Server } from "socket.io";

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*"
  }
})
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  private readonly roomMembers = new Map<string, Set<string>>();

  emit<T>(room: string, event: RealtimeEvent<T>) {
    this.server?.to(room).emit(event.type, event);
  }

  @SubscribeMessage("session:join")
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() body: { sessionId: string }) {
    client.join(body.sessionId);
    const members = this.roomMembers.get(body.sessionId) ?? new Set<string>();
    members.add(client.id);
    this.roomMembers.set(body.sessionId, members);

    const snapshot: RealtimeEvent<SessionSnapshotRealtimePayload> = {
      type: "session_snapshot",
      payload: {
        jamId: body.sessionId,
        participantsCount: members.size,
        generatedAt: new Date().toISOString()
      },
      emittedAt: new Date().toISOString()
    };
    this.server?.to(body.sessionId).emit(snapshot.type, snapshot);

    return {
      ok: true,
      serverTime: new Date().toISOString(),
      roomSize: members.size
    };
  }

  @SubscribeMessage("session:heartbeat")
  handleHeartbeat(@ConnectedSocket() client: Socket, @MessageBody() body: { sessionId: string }) {
    const members = this.roomMembers.get(body.sessionId) ?? new Set<string>();
    members.add(client.id);
    this.roomMembers.set(body.sessionId, members);
    return {
      ok: true,
      serverTime: new Date().toISOString(),
      roomSize: members.size
    };
  }

  @SubscribeMessage("session:leave")
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() body: { sessionId: string }) {
    client.leave(body.sessionId);
    const members = this.roomMembers.get(body.sessionId);
    members?.delete(client.id);
    if (members && members.size === 0) {
      this.roomMembers.delete(body.sessionId);
    }

    return {
      ok: true,
      serverTime: new Date().toISOString(),
      roomSize: members?.size ?? 0
    };
  }

  handleDisconnect(client: Socket) {
    for (const [room, members] of this.roomMembers.entries()) {
      if (members.delete(client.id) && members.size === 0) {
        this.roomMembers.delete(room);
      }
    }
  }
}
