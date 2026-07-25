import { Body, Controller, Post } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";

@Controller("helix/chat/messages")
export class ChatController {
  @Post()
  sendMessage(
    @Body()
    _body: {
      broadcaster_id: string;
      sender_id: string;
      message: string;
      reply_parent_message_id?: string;
    }
  ) {
    return {
      data: [
        {
          message_id: uuidv7(),
          is_sent: true,
        },
      ],
    };
  }
}
