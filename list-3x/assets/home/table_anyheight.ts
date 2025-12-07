import { _decorator, Component, Label, Node } from 'cc';
import { YXCollectionView } from '../lib/yx-collection-view';
import { YXTableLayout } from '../lib/yx-table-layout';
const { ccclass, property } = _decorator;

@ccclass('table_anyheight')
export class table_anyheight extends Component {
    protected start(): void {
        const listComp = this.node.getChildByName('list').getComponent(YXCollectionView)

        listComp.numberOfItems = () => {
            return 10000
        }
        listComp.cellForItemAt = (indexPath, collectionView) => {
            const cell = collectionView.dequeueReusableCell(`cell`)
            cell.getChildByName('label').getComponent(Label).string = `${indexPath}`
            return cell
        }

        let layout = new YXTableLayout()
        layout.spacing = 10
        layout.rowHeight = (indexPath) => {
            // 可以根据 `indexPath` 返回实际数据对应的 UI 高度
            return (indexPath.row % 2 == 0) ? 120 : 200
        }
        listComp.layout = layout

        listComp.reloadData()
    }
}


