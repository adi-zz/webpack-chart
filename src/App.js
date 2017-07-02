import React, { Component } from 'react';
import Input from 'react-bootstrap/lib/Input';
import CakeChart from 'cake-chart';
import Grid from 'react-bootstrap/lib/Grid';
import Row from 'react-bootstrap/lib/Row';
import Col from 'react-bootstrap/lib/Col';
import Panel from 'react-bootstrap/lib/Panel';

function getTreeFromStats(json) {
  const modules = json.modules || json.children[0].modules;
  const tree = modules.reduce((t, module) => {
    var path = module.name.split('/');

    path.reduce((subnode, segment) => {
      var subtree = subnode.children;
      var node = subtree.filter(n => n.label === segment)[0];
      if (!node) {
        node = {
          label: segment,
          value: 0,
          children: []
        };
        subtree.push(node);
      }

      node.value += module.size;

      return node;
    }, { children: t });

    return t;
  }, []);

  function sortTree(subtree) {
    subtree.forEach(node => {
      node.children = sortTree(node.children);
    });

    return subtree.sort((a, b) => b.value - a.value);
  }

  const sum = tree.reduce((s, node) => s + node.value, 0);

  return {
    children: sortTree(tree),
    label: json.publicPath,
    value: sum
  };
}

function findParent(node, child, parent) {
  if (node === child) return parent;
  for (let c of child.children || []) {
    const p = findParent(node, c, child);
    if (p) return p;
  }
}

function getSize(size) {
  if (size > (1 << 20)) {
    return (size / (1 << 20)).toFixed(3) + ' Mb';
  } else if (size > (1 << 10)) {
    return (size / (1 << 10)).toFixed(3) + ' Kb';
  } else {
    return size + ' b';
  }
}

function getGrayColor(slice) {
  const gray = Math.min(150 + slice.level * 30, 220);
  return `rgb(${gray}, ${gray}, ${gray})`;
}

function getGraySliceProps(slice, idx, props) {
  return { ...props, fill: getGrayColor(slice) };
}

function getLabelProps(demo, slice, idx, props) {
  return demo ?
    { ...props, style: { ...props.style, background: getGrayColor(slice) } } :
    props;
}

function getLabel(slice, label) {
  return (slice.end - slice.start > 15) &&
    (
      slice.level === 0 ?
        `${label || 'All'} (size: ${getSize(slice.node.value)})` :
        label
    );
}

export default class App extends Component {
  constructor(props) {
    super(props);
    const tree = getTreeFromStats(props.stats);
    this.state = {
      tree,
      selectedNode: tree,
      demo: true
    };
  }

  componentDidMount() {
    // if there's a statsJson, we assume it's a url to a stat json file, and we get it
    const url = new URL(window.location.href);
    const statsJson = url.searchParams.get("statsJson");
    if (statsJson) {
      console.log('request for:', statsJson)

      const oReq = new XMLHttpRequest();
      oReq.addEventListener("load", this.handleXHRFileLoad.bind(oReq, this.handleStats));
      oReq.open("GET", statsJson);
      oReq.send();
    }
  }

  render() {
    const { selectedNode, demo } = this.state;

    return (
      <Grid fluid>
        <Row>
          <Col xs={12} sm={4}>
            <Panel>
              <h3 className='text-center'>Webpack Chart</h3>
              <br/>
              <p>
              Generate <code>stats.json</code> for your project with this command:
              </p>
              <p>
              <pre>
                $ webpack --profile --json > stats.json
              </pre>
              </p>
              <p>
              and upload it here
              </p>
              <Input type='file'
                     onChange={this.handleSelectFile}
                     wrapperClassName='h5'
                     standalone />
              <p>
              or share the file online and send its URL as a GET param like <code>{this.remoteJsonSampleURL()}</code>
              </p>
              <p>
                Stats graph rendered with{' '}
                <a href='https://github.com/alexkuz/cake-chart' target='_blank'>Cake Chart</a>.
              </p>
              <p>
                This is a <a href='https://github.com/adi-zz/webpack-visualizer'>fork</a> of{' '}
                <a href='https://github.com/chrisbateman/webpack-visualizer'>webpack-visualizer</a>{' '}
                that allows providing <a href='https://adi-zz.github.io/webpack-chart/?statsJson=https%3A%2F%2Fraw.githubusercontent.com%2Fadi-zz%2Fbuilding-products-with-js%2Fmaster%2Fclient%2Fstats.json'>json as an input via a GET param</a>.
              </p>
            </Panel>
          </Col>
          <Col xs={12} sm={8}>
            {selectedNode &&
              <CakeChart data={selectedNode}
                         coreRadius={120}
                         ringWidth={80}
                         onClick={this.handleChartClick}
                         getSliceProps={demo ? getGraySliceProps : undefined}
                         getLabelProps={getLabelProps.bind(null, demo)}
                         getLabel={getLabel} />
            }
          </Col>
        </Row>
      </Grid>
    );
  }

  handleChartClick = node => {
    if (node === this.state.selectedNode) {
      const parent = findParent(node, this.state.tree);
      if (parent) {
        this.setState({
          selectedNode: parent
        });
      }
    } else if (node && node.children && node.children.length) {
      this.setState({
        selectedNode: node
      });
    }
  }

  handleSelectFile = e => {
    var file = e.target.files[0];

    var reader = new FileReader();

    reader.onload = this.handleFileLoad;

    reader.readAsText(file);
  }

  handleFileLoad = e => {
    this.handleStats(e.target.result)
  }

  handleXHRFileLoad = function(handleStats){
    console.log('in handleXHRFileLoad', this.responseText)
    handleStats(this.responseText)
  }

  handleStats = stats => {
    try {
      const json = JSON.parse(stats);

      const tree = getTreeFromStats(json);

      this.setState({ selectedNode: tree, tree, demo: false });
    } catch (error) {
      console.error('json parse error', error.message)      
    }
  }

  remoteJsonSampleURL = () => {
    const l = window.location
    return `${l.protocol}//${l.host}${l.pathname}?statsJson=[URL to stats.json]`
  }
}
