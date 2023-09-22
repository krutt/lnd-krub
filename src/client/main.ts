/* ~~/src/client/main.ts */

// imports
import '../assets/styles.css'
import { AwesomeQR } from 'awesome-qr'
import { Channel, Dashblob } from '../types'
import Mustache from 'mustache'
import wellKnown from '../assets/pubkeys.json'

let render = (dashblob: Dashblob, channels: Channel[], qrBuffer: string | undefined) => {
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = Mustache.render(
    `
    <div class="holder">
      <div class="container32">
        <div class="logo">
          <img alt="logo" src="/lndkrub.svg">
        </div>
        <div class="scroll">
          <div class="boxes">
            <div class="box container24">
              <p class="meta">
                Channels
              </p>
              <h3>
                Active
              </h3>
              <span class="number1">
                {{num_active_channels}}
              </span>
            </div>
            <div class="box container24">
              <p class="meta">
                Channels
              </p>
              <h3>
                Pending
              </h3>
              <span class="number1">
                {{num_pending_channels}}
              </span>
            </div>
            <div class="box container24">
              <p class="meta">
                Connected
              </p>
              <h3>
                Peers
              </h3>
              <span class="number1">
                {{ num_peers }}
              </span>
            </div>
            <div class="box container24">
              <p class="meta">
                Block
              </p>
              <h3>
                Height
              </h3>
              <span class="label right synced" title="{{ synced_to_chain }}"></span>
              <span class="number1">{{block_height}}</span>
            </div>
          </div>
        </div>
        <h3>
          Channels
        </h3>
        <div class="box container16">
          <div class="table">
            {{#channels}}
            <a class="decor" href="https://1ml.com/node/{{remote_pubkey}}" target="_blank">
              <div class="row">
                <div class="name">
                  {{#name}}
                <h2>
                  {{name}}
                </h2>
                {{/name}}
                {{^name}}
                <h2>
                  {{remote_pubkey}}
                </h2>
                {{/name}}
                <span class="amount">
                  {{capacity_btc}} BTC
                </span>
              </div>
              <div class="graph">
                <progress id="progressbar" class="" value="{{local}}" max="{{total}}" style="width: {{size}}%"></progress>
              </div>
              {{^active}}
              <div class="status">
                <span class="label right" title="inactive"></span>
              </div>
              {{/active}} 
              {{#active}}
              <div class="status">
                <span class="label right" title="active"></span>
              </div>
              {{/active}}                          
            </div>
          </a>
          {{/channels}}
        </div>
      </div>
    </div>
    <div class="sidebar container32">
      <div>
        <p class="meta">
          Connect via QR code
        </p>
      </div>
      <img src="{{ qrBuffer }}" class="qr">
      <div class="container32 nosidepadding">
        <p class="meta">
          Node URI
        </p>
        {{#uris}}
        <p class="uri">
          {{.}}
        </p>
        {{/uris}}
      </div>
      <footer>
        <a href="https://github.com/aekasitt/lnd-krub" target="_blank">about</a>
      </footer>
    </div>
  `,
    { ...dashblob, channels, qrBuffer }
  )
}

let fetchInfo = async () => {
  let body = {}
  let headers = { 'Content-Type': 'application/json' }
  let method = 'PUT'
  if (document.cookie) {
    let cookies = document.cookie
      .split(';')
      .map((pair: string) => pair.split('='))
      .reduce((acc, kv: string[]) => {
        acc[decodeURIComponent(kv[0].trim())] = decodeURIComponent(kv[1].trim())
        return acc
      }, {})
    body['_csrf'] = cookies['xsrf-token']
  }
  let info = await (
    await fetch('/dashboard', { body: JSON.stringify(body), method, headers })
  ).json()
  let dashblob: Dashblob = info[0]
  let channels: Channel[] = info[1]
  let displayChannels: Channel[] = []
  let max_chan_capacity = -1
  for (const channel of channels) {
    max_chan_capacity = Math.max(max_chan_capacity, channel.capacity)
  }
  for (let channel of channels) {
    let magic = max_chan_capacity / 100
    channel.local = channel.local_balance * 1
    channel.total = channel.capacity * 1
    channel.size = Math.round(channel.capacity / magic) // total size of the bar on page. 100% means it takes maximum width
    channel.capacity_btc = channel.capacity / 100000000
    channel.name = wellKnown[channel.remote_pubkey]
    if (channel.name) {
      displayChannels.unshift(channel)
    } else {
      displayChannels.push(channel)
    }
  }
  // @ts-ignore
  let qrCode: string = 'bluewallet:setlndhuburl?url=' + encodeURIComponent(location.href)
  let qrBuffer = await new AwesomeQR({ text: qrCode, size: 500 }).draw()
  render(dashblob, displayChannels, qrBuffer?.toString())
}

window.onload = () => {
  fetchInfo()
  setTimeout(() => location.replace(location.href), 60000) // 60 seconds
}
