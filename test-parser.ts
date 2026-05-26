import fs from 'fs'
import { parseMarkdownToAST } from './src/utils/docsParser'

const md = fs.readFileSync('./USER_GUIDE.md', 'utf8')
const parsed = parseMarkdownToAST(md)

const ids: string[] = []
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flatten = (sections: any[]) => {
  for (const sec of sections) {
    ids.push(sec.id)
    if (sec.subsections) {
      flatten(sec.subsections)
    }
  }
}
flatten(parsed)
console.log(JSON.stringify(ids, null, 2))
