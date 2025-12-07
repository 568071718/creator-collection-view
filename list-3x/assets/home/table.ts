import { _decorator, Component, Label, Node } from 'cc';
import { YXCollectionView } from '../lib/yx-collection-view';
import { YXTableLayout } from '../lib/yx-table-layout';
const { ccclass, property } = _decorator;

@ccclass('table')
export class table extends Component {
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
        layout.rowHeight = 120
        listComp.layout = layout

        listComp.reloadData()
    }
}


