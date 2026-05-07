import { MedusaService } from "@medusajs/framework/utils"
import { Post } from "./models/post"
import { PostBlock } from "./models/postBlock"
import { PostParagraph } from "./models/postParagraph"

class PostModuleService extends MedusaService({
  Post,
  PostBlock,
  PostParagraph,
}) {}

export default PostModuleService
