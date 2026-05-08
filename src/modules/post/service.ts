import { MedusaService } from "@medusajs/framework/utils"
import { Post } from "./models/post"
import { PostBlock } from "./models/postBlock"
import { PostParagraph } from "./models/postParagraph"

class PostModuleService extends MedusaService({
  Post,
  PostBlock,
  PostParagraph,
}) {
  constructor(container?: any) {
    super(container);
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      module: "service-post",
      operation: "init",
      phase: "done",
    }));
  }
}

export default PostModuleService
