import { _decorator, Component, Label, math, Node } from 'cc';
import { YXCollectionView } from '../lib/yx-collection-view';
import { GridLayout } from '../lib/grid-layout';
const { ccclass, property } = _decorator;

@ccclass('grid')
export class grid extends Component {
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

        let layout = new GridLayout()
        layout.horizontalSpacing = 20
        layout.verticalSpacing = 20
        layout.itemSize = new math.Size(150, 180)
        listComp.layout = layout

        listComp.reloadData()
    }
}


