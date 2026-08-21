var IrrigationScheduleCard=function(t){"use strict";function e(t,e,i,r){var s,o=arguments.length,n=o<3?e:null===r?r=Object.getOwnPropertyDescriptor(e,i):r;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)n=Reflect.decorate(t,e,i,r);else for(var a=t.length-1;a>=0;a--)(s=t[a])&&(n=(o<3?s(n):o>3?s(e,i,n):s(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n}"function"==typeof SuppressedError&&SuppressedError;const i=globalThis,r=i.ShadowRoot&&(void 0===i.ShadyCSS||i.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),o=new WeakMap;let n=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(r&&void 0===t){const i=void 0!==e&&1===e.length;i&&(t=o.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&o.set(e,t))}return t}toString(){return this.cssText}};const a=r?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new n("string"==typeof t?t:t+"",void 0,s))(e)})(t):t,{is:l,defineProperty:c,getOwnPropertyDescriptor:d,getOwnPropertyNames:h,getOwnPropertySymbols:u,getPrototypeOf:p}=Object,g=globalThis,m=g.trustedTypes,_=m?m.emptyScript:"",f=g.reactiveElementPolyfillSupport,v=(t,e)=>t,b={toAttribute(t,e){switch(e){case Boolean:t=t?_:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},y=(t,e)=>!l(t,e),x={attribute:!0,type:String,converter:b,reflect:!1,useDefault:!1,hasChanged:y};Symbol.metadata??=Symbol("metadata"),g.litPropertyMetadata??=new WeakMap;let $=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=x){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),r=this.getPropertyDescriptor(t,i,e);void 0!==r&&c(this.prototype,t,r)}}static getPropertyDescriptor(t,e,i){const{get:r,set:s}=d(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:r,set(e){const o=r?.call(this);s?.call(this,e),this.requestUpdate(t,o,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??x}static _$Ei(){if(this.hasOwnProperty(v("elementProperties")))return;const t=p(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(v("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(v("properties"))){const t=this.properties,e=[...h(t),...u(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(a(t))}else void 0!==t&&e.push(a(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((t,e)=>{if(r)t.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const r of e){const e=document.createElement("style"),s=i.litNonce;void 0!==s&&e.setAttribute("nonce",s),e.textContent=r.cssText,t.appendChild(e)}})(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),r=this.constructor._$Eu(t,i);if(void 0!==r&&!0===i.reflect){const s=(void 0!==i.converter?.toAttribute?i.converter:b).toAttribute(e,i.type);this._$Em=t,null==s?this.removeAttribute(r):this.setAttribute(r,s),this._$Em=null}}_$AK(t,e){const i=this.constructor,r=i._$Eh.get(t);if(void 0!==r&&this._$Em!==r){const t=i.getPropertyOptions(r),s="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:b;this._$Em=r;const o=s.fromAttribute(e,t.type);this[r]=o??this._$Ej?.get(r)??o,this._$Em=null}}requestUpdate(t,e,i,r=!1,s){if(void 0!==t){const o=this.constructor;if(!1===r&&(s=this[t]),i??=o.getPropertyOptions(t),!((i.hasChanged??y)(s,e)||i.useDefault&&i.reflect&&s===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:r,wrapped:s},o){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??e??this[t]),!0!==s||void 0!==o)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===r&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,r=this[e];!0!==t||this._$AL.has(e)||void 0===r||this.C(e,void 0,i,r)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};$.elementStyles=[],$.shadowRootOptions={mode:"open"},$[v("elementProperties")]=new Map,$[v("finalized")]=new Map,f?.({ReactiveElement:$}),(g.reactiveElementVersions??=[]).push("2.1.2");const w=globalThis,E=t=>t,S=w.trustedTypes,A=S?S.createPolicy("lit-html",{createHTML:t=>t}):void 0,k="$lit$",D=`lit$${Math.random().toFixed(9).slice(2)}$`,M="?"+D,C=`<${M}>`,P=document,N=()=>P.createComment(""),z=t=>null===t||"object"!=typeof t&&"function"!=typeof t,T=Array.isArray,O="[ \t\n\f\r]",H=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,R=/-->/g,F=/>/g,I=RegExp(`>|${O}(?:([^\\s"'>=/]+)(${O}*=${O}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),j=/'/g,U=/"/g,B=/^(?:script|style|textarea|title)$/i,L=(t=>(e,...i)=>({_$litType$:t,strings:e,values:i}))(1),V=Symbol.for("lit-noChange"),W=Symbol.for("lit-nothing"),q=new WeakMap,Z=P.createTreeWalker(P,129);function K(t,e){if(!T(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==A?A.createHTML(e):e}const G=(t,e)=>{const i=t.length-1,r=[];let s,o=2===e?"<svg>":3===e?"<math>":"",n=H;for(let e=0;e<i;e++){const i=t[e];let a,l,c=-1,d=0;for(;d<i.length&&(n.lastIndex=d,l=n.exec(i),null!==l);)d=n.lastIndex,n===H?"!--"===l[1]?n=R:void 0!==l[1]?n=F:void 0!==l[2]?(B.test(l[2])&&(s=RegExp("</"+l[2],"g")),n=I):void 0!==l[3]&&(n=I):n===I?">"===l[0]?(n=s??H,c=-1):void 0===l[1]?c=-2:(c=n.lastIndex-l[2].length,a=l[1],n=void 0===l[3]?I:'"'===l[3]?U:j):n===U||n===j?n=I:n===R||n===F?n=H:(n=I,s=void 0);const h=n===I&&t[e+1].startsWith("/>")?" ":"";o+=n===H?i+C:c>=0?(r.push(a),i.slice(0,c)+k+i.slice(c)+D+h):i+D+(-2===c?e:h)}return[K(t,o+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),r]};class J{constructor({strings:t,_$litType$:e},i){let r;this.parts=[];let s=0,o=0;const n=t.length-1,a=this.parts,[l,c]=G(t,e);if(this.el=J.createElement(l,i),Z.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(r=Z.nextNode())&&a.length<n;){if(1===r.nodeType){if(r.hasAttributes())for(const t of r.getAttributeNames())if(t.endsWith(k)){const e=c[o++],i=r.getAttribute(t).split(D),n=/([.?@])?(.*)/.exec(e);a.push({type:1,index:s,name:n[2],strings:i,ctor:"."===n[1]?et:"?"===n[1]?it:"@"===n[1]?rt:tt}),r.removeAttribute(t)}else t.startsWith(D)&&(a.push({type:6,index:s}),r.removeAttribute(t));if(B.test(r.tagName)){const t=r.textContent.split(D),e=t.length-1;if(e>0){r.textContent=S?S.emptyScript:"";for(let i=0;i<e;i++)r.append(t[i],N()),Z.nextNode(),a.push({type:2,index:++s});r.append(t[e],N())}}}else if(8===r.nodeType)if(r.data===M)a.push({type:2,index:s});else{let t=-1;for(;-1!==(t=r.data.indexOf(D,t+1));)a.push({type:7,index:s}),t+=D.length-1}s++}}static createElement(t,e){const i=P.createElement("template");return i.innerHTML=t,i}}function Q(t,e,i=t,r){if(e===V)return e;let s=void 0!==r?i._$Co?.[r]:i._$Cl;const o=z(e)?void 0:e._$litDirective$;return s?.constructor!==o&&(s?._$AO?.(!1),void 0===o?s=void 0:(s=new o(t),s._$AT(t,i,r)),void 0!==r?(i._$Co??=[])[r]=s:i._$Cl=s),void 0!==s&&(e=Q(t,s._$AS(t,e.values),s,r)),e}class X{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,r=(t?.creationScope??P).importNode(e,!0);Z.currentNode=r;let s=Z.nextNode(),o=0,n=0,a=i[0];for(;void 0!==a;){if(o===a.index){let e;2===a.type?e=new Y(s,s.nextSibling,this,t):1===a.type?e=new a.ctor(s,a.name,a.strings,this,t):6===a.type&&(e=new st(s,this,t)),this._$AV.push(e),a=i[++n]}o!==a?.index&&(s=Z.nextNode(),o++)}return Z.currentNode=P,r}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class Y{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,r){this.type=2,this._$AH=W,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=Q(this,t,e),z(t)?t===W||null==t||""===t?(this._$AH!==W&&this._$AR(),this._$AH=W):t!==this._$AH&&t!==V&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>T(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==W&&z(this._$AH)?this._$AA.nextSibling.data=t:this.T(P.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,r="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=J.createElement(K(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===r)this._$AH.p(e);else{const t=new X(r,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=q.get(t.strings);return void 0===e&&q.set(t.strings,e=new J(t)),e}k(t){T(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,r=0;for(const s of t)r===e.length?e.push(i=new Y(this.O(N()),this.O(N()),this,this.options)):i=e[r],i._$AI(s),r++;r<e.length&&(this._$AR(i&&i._$AB.nextSibling,r),e.length=r)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=E(t).nextSibling;E(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class tt{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,r,s){this.type=1,this._$AH=W,this._$AN=void 0,this.element=t,this.name=e,this._$AM=r,this.options=s,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=W}_$AI(t,e=this,i,r){const s=this.strings;let o=!1;if(void 0===s)t=Q(this,t,e,0),o=!z(t)||t!==this._$AH&&t!==V,o&&(this._$AH=t);else{const r=t;let n,a;for(t=s[0],n=0;n<s.length-1;n++)a=Q(this,r[i+n],e,n),a===V&&(a=this._$AH[n]),o||=!z(a)||a!==this._$AH[n],a===W?t=W:t!==W&&(t+=(a??"")+s[n+1]),this._$AH[n]=a}o&&!r&&this.j(t)}j(t){t===W?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class et extends tt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===W?void 0:t}}class it extends tt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==W)}}class rt extends tt{constructor(t,e,i,r,s){super(t,e,i,r,s),this.type=5}_$AI(t,e=this){if((t=Q(this,t,e,0)??W)===V)return;const i=this._$AH,r=t===W&&i!==W||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,s=t!==W&&(i===W||r);r&&this.element.removeEventListener(this.name,this,i),s&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class st{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){Q(this,t)}}const ot=w.litHtmlPolyfillSupport;ot?.(J,Y),(w.litHtmlVersions??=[]).push("3.3.3");const nt=globalThis;class at extends ${constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const r=i?.renderBefore??e;let s=r._$litPart$;if(void 0===s){const t=i?.renderBefore??null;r._$litPart$=s=new Y(e.insertBefore(N(),t),t,void 0,i??{})}return s._$AI(t),s})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return V}}at._$litElement$=!0,at.finalized=!0,nt.litElementHydrateSupport?.({LitElement:at});const lt=nt.litElementPolyfillSupport;lt?.({LitElement:at}),(nt.litElementVersions??=[]).push("4.2.2");const ct={attribute:!0,type:String,converter:b,reflect:!1,hasChanged:y},dt=(t=ct,e,i)=>{const{kind:r,metadata:s}=i;let o=globalThis.litPropertyMetadata.get(s);if(void 0===o&&globalThis.litPropertyMetadata.set(s,o=new Map),"setter"===r&&((t=Object.create(t)).wrapped=!0),o.set(i.name,t),"accessor"===r){const{name:r}=i;return{set(i){const s=e.get.call(this);e.set.call(this,i),this.requestUpdate(r,s,t,!0,i)},init(e){return void 0!==e&&this.C(r,void 0,t,e),e}}}if("setter"===r){const{name:r}=i;return function(i){const s=this[r];e.call(this,i),this.requestUpdate(r,s,t,!0,i)}}throw Error("Unsupported decorator location: "+r)};function ht(t){return(e,i)=>"object"==typeof i?dt(t,e,i):((t,e,i)=>{const r=e.hasOwnProperty(i);return e.constructor.createProperty(i,t),r?Object.getOwnPropertyDescriptor(e,i):void 0})(t,e,i)}function ut(t){return ht({...t,state:!0,attribute:!1})}const pt="irrigation_scheduler",gt=!0,mt=!0,_t=!1,ft=[{name:"entity",selector:{entity:{domain:"sensor"}}},{name:"name",selector:{text:{}}},{name:"show_next_run",selector:{boolean:{}}},{name:"show_water_now",selector:{boolean:{}}},{name:"compact",selector:{boolean:{}}}],vt={entity:"Entidade (sensor.<zona>_next_run)",name:"Nome",show_next_run:"Mostrar próximo horário",show_water_now:"Mostrar regar agora",compact:"Compacto"};class bt extends at{constructor(){super(...arguments),this._computeLabel=t=>vt[t.name]??t.name}setConfig(t){this._config=t}render(){return this.hass&&this._config?L`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${ft}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `:L``}_valueChanged(t){const e=t.detail?.value;if(!e||!this._config)return;const i={...this._config,...e};this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i},bubbles:!0,composed:!0}))}}e([ht({attribute:!1})],bt.prototype,"hass",void 0),e([ut()],bt.prototype,"_config",void 0);const yt=((t,...e)=>{const i=1===t.length?t[0]:e.reduce((e,i,r)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[r+1],t[0]);return new n(i,t,s)})`
  /* Mirrors the sibling light_scheduler card's token block so both cards
     share one visual language. The green is that card's own value rather
     than the theme's --success-color, which varies per theme and would
     drift the two apart. */
  :host {
    display: block;
    --w-blue: var(--primary-color, #03a9f4);
    --w-green: #76d84b;
  }

  ha-card {
    overflow: hidden;
  }

  .card-body {
    padding: 0 16px 16px;
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 14px 16px 0;
  }

  .zone-icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgba(127, 127, 127, 0.22);
    color: var(--primary-color, #03a9f4);
  }

  .zone-icon ha-icon {
    --mdc-icon-size: 20px;
  }

  .header-title {
    margin: 0;
    flex: 1 1 110px;
    font-size: 20px;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: -0.2px;
    color: var(--primary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    margin-left: auto;
  }

  .icon-button {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
  }

  .icon-button:hover {
    background: rgba(127, 127, 127, 0.14);
  }

  .icon-button ha-icon {
    --mdc-icon-size: 20px;
  }

  /* Outlined chip rather than a filled pill: the state reads as a label on
     the card, not as a button competing with the toggle beside it. */
  .status {
    flex-shrink: 0;
    height: 24px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid currentColor;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }

  .status ha-icon {
    --mdc-icon-size: 14px;
  }

  .status-watering {
    color: var(--primary-color, #03a9f4);
    background: rgba(3, 169, 244, 0.09);
  }

  .status-scheduled {
    color: var(--w-green);
    background: rgba(73, 190, 42, 0.09);
  }

  .status-disabled {
    color: var(--secondary-text-color);
  }

  .summary {
    margin: 12px 16px 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 14px;
  }

  .summary-main {
    min-width: 0;
  }

  .summary-main strong {
    display: block;
    font-size: 22px;
    line-height: 1.1;
    letter-spacing: -0.35px;
  }

  .summary-main span {
    display: block;
    margin-top: 5px;
    color: var(--secondary-text-color);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .summary-stat {
    text-align: right;
    min-width: 78px;
  }

  .summary-stat span {
    display: block;
    font-size: 10px;
    color: var(--secondary-text-color);
  }

  .summary-stat strong {
    display: block;
    margin-top: 1px;
    font-size: 21px;
    line-height: 1.1;
    letter-spacing: -0.35px;
  }

  .section-title {
    margin: 0 0 8px;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 600;
    color: var(--primary-text-color);
  }

  /* With two reservoirs the section header becomes a two-column row so
     "Reservatório" and "Reservatório 2" line up with the pH/EC tiles below. */
  .section-title-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    margin: 0 0 8px;
  }

  .section-title-row .section-title {
    margin: 0;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .metric {
    min-width: 0;
    height: 44px;
    padding: 6px 8px;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr);
    align-items: center;
    gap: 7px;
    text-align: left;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.22));
    border-radius: 7px;
    background: rgba(127, 127, 127, 0.045);
    color: var(--primary-text-color);
    cursor: pointer;
  }

  .metric:hover {
    background: rgba(127, 127, 127, 0.1);
  }

  .metric ha-icon {
    --mdc-icon-size: 19px;
    color: var(--secondary-text-color);
  }

  .metric-copy {
    min-width: 0;
  }

  .metric-copy small {
    display: block;
    margin-bottom: 1px;
    font-size: 9px;
    color: var(--secondary-text-color);
  }

  .metric-copy strong {
    display: block;
    font-size: 11px;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .metric.ec-metric ha-icon,
  .metric.ec-metric .metric-copy strong {
    color: var(--primary-color, #03a9f4);
  }

  .metric.ph-metric.in-range ha-icon,
  .metric.ph-metric.in-range .metric-copy strong {
    color: var(--success-color, #4caf50);
  }

  .metric.ph-metric.out-of-range ha-icon,
  .metric.ph-metric.out-of-range .metric-copy strong {
    color: var(--error-color, #f44336);
  }

  .reservoir-level {
    margin-top: 6px;
    padding: 7px 9px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.22));
    border-radius: 7px;
    background: rgba(127, 127, 127, 0.045);
  }

  .reservoir-level-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .reservoir-level-top small {
    flex: 1;
    min-width: 0;
    font-size: 9px;
    color: var(--secondary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reservoir-level-top strong {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .reservoir-level-bar {
    height: 5px;
    margin-top: 5px;
    border-radius: 999px;
    background: rgba(127, 127, 127, 0.28);
    overflow: hidden;
  }

  .reservoir-level-fill {
    height: 100%;
    border-radius: inherit;
    background: var(--primary-color, #03a9f4);
  }

  .refill-button {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--secondary-background-color, rgba(255, 255, 255, 0.08));
    color: var(--primary-color, #03a9f4);
    cursor: pointer;
  }

  .refill-button:hover {
    filter: brightness(1.15);
  }

  .refill-button ha-icon {
    --mdc-icon-size: 14px;
  }

  .last-run {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 10px 16px 0;
    font-size: 10px;
    color: var(--secondary-text-color);
    cursor: pointer;
  }

  .last-run ha-icon {
    --mdc-icon-size: 15px;
    flex-shrink: 0;
  }

  .last-run:hover {
    color: var(--primary-text-color);
  }

  .last-run-chevron {
    --mdc-icon-size: 15px;
    flex-shrink: 0;
  }

  .section-divider {
    height: 1px;
    background: var(--divider-color, rgba(127, 127, 127, 0.16));
    margin: 11px 16px 10px;
  }

  .history-dialog {
    width: min(90vw, 440px);
    max-height: 80vh;
    overflow-y: auto;
    box-sizing: border-box;
  }

  .history-subtitle {
    font-size: 13px;
    font-weight: 400;
    color: var(--secondary-text-color);
    margin-top: 2px;
  }

  .history-stats {
    display: flex;
    gap: 24px;
    padding: 8px 0 12px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.1));
  }

  .history-stat {
    display: flex;
    flex-direction: column;
  }

  .history-stat-value {
    font-size: 18px;
    font-weight: 600;
  }

  .history-stat-label {
    font-size: 11px;
    color: var(--secondary-text-color);
  }

  .history-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .history-day-header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--secondary-text-color);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.06));
  }

  .history-day-total {
    font-weight: 400;
  }

  .history-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 13px;
  }

  .history-entry ha-icon {
    --mdc-icon-size: 16px;
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }

  .history-entry-detail {
    color: var(--secondary-text-color);
    white-space: nowrap;
  }

  .water-now-progress {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .water-now-timer {
    font-size: 9px;
    line-height: 1;
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .progress-track {
    height: 6px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(127, 127, 127, 0.28);
  }

  .progress-fill {
    height: 100%;
    border-radius: inherit;
    background: var(--primary-color, #03a9f4);
    transition: width 1s linear;
  }

  .schedules {
    display: grid;
    gap: 4px;
  }

  .schedule-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 7px;
    padding: 2px 8px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.22));
    border-radius: 6px;
    background: rgba(127, 127, 127, 0.04);
  }

  .schedule-row:hover {
    background: rgba(127, 127, 127, 0.1);
  }

  /* Geometry copied from light_scheduler's .toggle: a 30x18 rail with a
     14px knob travelling 12px. */
  .toggle {
    position: relative;
    width: 30px;
    height: 18px;
    flex: none;
    border: none;
    border-radius: 999px;
    padding: 0;
    background: none;
    cursor: pointer;
  }

  .toggle .track {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: var(--w-green);
    transition: background 0.15s ease;
    pointer-events: none;
  }

  .toggle .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    transform: translateX(12px);
    transition: transform 0.15s ease;
    pointer-events: none;
  }

  .toggle.off .track {
    background: rgba(127, 127, 127, 0.4);
  }

  .toggle.off .thumb {
    transform: translateX(0);
  }

  /* Comfortable hit area without changing the 18px visual; the inset stays
     inside the header gap / row padding so it never steals a neighbour's
     clicks. */
  .toggle::before {
    content: "";
    position: absolute;
    inset: -7px -5px;
  }

  .toggle:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .toggle:focus-visible {
    outline: 2px solid var(--w-blue);
    outline-offset: 2px;
  }



  .schedule-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .schedule-info-top {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .schedule-time {
    font-size: 11px;
    line-height: 1.15;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .schedule-days {
    display: flex;
    gap: 1px;
    flex-shrink: 0;
    letter-spacing: 1px;
  }

  .day-initial {
    font-size: 10px;
    line-height: 1.15;
    width: 11px;
    text-align: center;
    color: var(--disabled-text-color, rgba(255, 255, 255, 0.3));
  }

  .day-initial.active {
    color: var(--primary-text-color);
    font-weight: 600;
  }

  .warning-icon {
    --mdc-icon-size: 13px;
    color: var(--warning-color, #ff9800);
    flex-shrink: 0;
  }

  .status-icon {
    --mdc-icon-size: 13px;
    flex-shrink: 0;
  }

  .status-icon.status-done {
    color: var(--success-color, #4caf50);
  }

  .status-icon.status-pending {
    color: var(--secondary-text-color);
  }

  .schedule-duration {
    font-size: 9px;
    line-height: 1.2;
    color: var(--secondary-text-color);
    min-width: 0;
  }

  .schedule-volume {
    color: var(--primary-color, #03a9f4);
    font-weight: 500;
  }

  .schedule-perpot {
    font-weight: 400;
  }

  .schedule-actions {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .row-action {
    width: 24px;
    height: 24px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    color: var(--secondary-text-color);
    background: transparent;
    cursor: pointer;
  }

  .row-action:hover {
    background: rgba(3, 169, 244, 0.14);
    color: var(--w-blue);
  }

  .row-action.delete:hover {
    background: rgba(255, 80, 80, 0.12);
    color: var(--error-color);
  }

  .row-action ha-icon {
    --mdc-icon-size: 15px;
  }

  .empty {
    padding: 16px 0;
    text-align: center;
    color: var(--secondary-text-color);
    font-size: 14px;
  }

  .add-schedule-button {
    width: 100%;
    height: 31px;
    margin-top: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
    border-radius: 6px;
    background: transparent;
    color: var(--w-blue);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
  }

  .add-schedule-button:hover {
    background: rgba(127, 127, 127, 0.08);
  }

  .add-schedule-button ha-icon {
    --mdc-icon-size: 15px;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-top: 9px;
  }

  .actions.watering {
    gap: 10px;
  }

  .water-now-button {
    height: 31px;
    padding: 0 13px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: none;
    border-radius: 6px;
    background: var(--w-blue);
    color: var(--text-primary-color, #fff);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .water-now-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .water-now-button ha-icon {
    --mdc-icon-size: 15px;
  }

  .water-now-button.stop {
    background: transparent;
    border: 1px solid rgba(127, 127, 127, 0.32);
    color: var(--w-blue);
    font-weight: 500;
  }

  .water-now-button.stop ha-icon {
    --mdc-icon-size: 13px;
  }

  .config-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    color: var(--error-color, #db4437);
    font-size: 14px;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dialog {
    width: min(90vw, 380px);
    background: var(--card-background-color, var(--primary-background-color, #fff));
    color: var(--primary-text-color);
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }

  .dialog-header {
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 12px;
  }

  /* Both the schedule dialog and the settings dialog use the same rich
     header: an eyebrow, a title, and a close button -- shared here so a
     third dialog can opt in without duplicating the rule. */
  .schedule-dialog .dialog-header,
  .settings-dialog .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .schedule-dialog .dialog-header small,
  .settings-dialog .dialog-header small {
    color: var(--secondary-text-color);
    font-size: 10px;
    font-weight: 400;
  }

  .schedule-dialog .dialog-header h3,
  .settings-dialog .dialog-header h3 {
    margin: 2px 0 0;
    font-size: 18px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  /* The settings dialog holds many fields; keep the header/actions pinned and
     let only the field list scroll on short viewports. */
  .settings-dialog {
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .settings-dialog .dialog-body {
    overflow-y: auto;
    padding-right: 4px;
  }

  /* Pairs simple numeric fields two per row instead of one long column --
     the settings dialog has nine fields; stacking them all singly reads as
     an undifferentiated scroll. */
  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .field-grid .field {
    min-width: 0;
  }

  .dialog-divider {
    height: 1px;
    margin: 2px 0;
    background: var(--divider-color, rgba(127, 127, 127, 0.16));
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field label {
    font-size: 13px;
    color: var(--secondary-text-color);
  }

  .field input[type="time"],
  .field input[type="number"],
  .field input[type="text"] {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 16px;
    color: var(--primary-text-color);
    background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    color-scheme: dark;
  }

  .day-fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }

  .day-fieldset legend {
    color: var(--secondary-text-color);
    font-size: 11px;
    padding: 0;
  }

  .day-grid {
    margin-top: 7px;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .day-grid input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .day-grid span {
    height: 31px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(127, 127, 127, 0.35);
    border-radius: 5px;
    color: var(--secondary-text-color);
    font-size: 10px;
    cursor: pointer;
  }

  .day-grid input:checked + span {
    border-color: var(--w-blue);
    color: var(--w-blue);
    background: rgba(3, 169, 244, 0.1);
  }

  .duration-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    padding: 8px 12px;
  }

  .duration-segment {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .duration-segment-label {
    font-size: 11px;
    color: var(--secondary-text-color);
    margin-bottom: 2px;
  }

  /* Outranks the generic .field number-input rule, which otherwise forced
     this back to 16px. Staying ABOVE 16px also avoids iOS zoom-on-focus. */
  .field input.duration-segment-input {
    width: 30px;
    text-align: center;
    font-size: 18px;
    font-weight: 500;
    color: var(--primary-text-color);
    background: transparent;
    border: none;
    padding: 0;
    color-scheme: dark;
  }

  .duration-segment-input::-webkit-outer-spin-button,
  .duration-segment-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .duration-segment-input {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .duration-colon {
    font-size: 18px;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .duration-preview {
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 7px;
    border-radius: 6px;
    color: var(--secondary-text-color);
    background: rgba(3, 169, 244, 0.08);
    font-size: 10px;
  }

  .duration-preview ha-icon {
    --mdc-icon-size: 17px;
    color: var(--w-blue);
  }

  .duration-preview strong {
    color: var(--primary-text-color);
  }

  .duration-row {
    display: flex;
    gap: 8px;
  }

  .duration-part {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .duration-part input[type="number"] {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 16px;
    color: var(--primary-text-color);
    background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    color-scheme: dark;
  }

  .duration-part span {
    font-size: 13px;
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .dialog-actions button {
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .dialog-cancel {
    background: transparent;
    color: var(--primary-text-color);
  }

  .dialog-save {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }

  .dialog-actions-spacer {
    flex: 1;
  }

  .dialog-actions .delete-button {
    display: flex;
    align-items: center;
    gap: 5px;
    padding-left: 0;
    background: transparent;
    color: var(--error-color);
  }

  .dialog-actions .delete-button ha-icon {
    --mdc-icon-size: 16px;
  }

  .schedule-dialog .dialog-actions .dialog-cancel {
    border: 1px solid rgba(127, 127, 127, 0.35);
    background: transparent;
  }

  .form-error {
    color: var(--error-color, #db4437);
    font-size: 13px;
  }

  .compact .card-body {
    padding: 0 12px 12px;
  }

  .compact .header {
    padding: 12px 12px 4px;
  }

  .compact .schedule-days,
  .compact .summary-main span,
  .compact .last-run {
    display: none;
  }
`,xt=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"],$t=/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;function wt(t){const e=$t.exec(t);if(!e)return null;const i=Number(e[1]),r=Number(e[2]),s=e[3]?Number(e[3]):0;return i>23||r>59||s>59?null:{hour:i,minute:r,second:s}}function Et(t){const e=wt(t);if(!e)return t;const i=t.slice(0,t.indexOf(":")),r=String(e.minute).padStart(2,"0");return e.second>0?`${i}:${r}:${String(e.second).padStart(2,"0")}`:`${i}:${r}`}function St(){return[...xt]}function At(t){const e=Math.max(0,Math.round(Number.isFinite(t)?t:0));if(e<60)return`${e} s`;const i=Math.round(e/60),r=Math.floor(i/60),s=i%60,o=[];return r>0&&o.push(`${r} h`),s>0&&o.push(`${s} min`),o.join(" ")}function kt(t){if(!Number.isFinite(t))return"0 L";const e=Math.round(100*t)/100;return 0===e&&t>0?"< 0.01 L":`${e} L`}function Dt(t,e){const i=function(t,e){const i=Number.isFinite(t)?t:0;return i<=0?null:i/3600*(Number.isFinite(e)?Math.max(0,e):0)}(t,e);return null===i?null:1e3*i}function Mt(t,e,i){const r=Dt(t,e);if(null===r)return null;return r*(Number.isFinite(i)&&i>0?i:1)}function Ct(t){return Number.isFinite(t)?t>=1e3?kt(t/1e3):Math.round(100*t)/100+" ml":"0 ml"}function Pt(t){const e=wt(t);return e?3600*e.hour+60*e.minute+e.second:-1}function Nt(t,e){if(!Number.isFinite(t))return"?";const i=Math.round(100*t)/100;return e?`${i} ${e}`:`${i}`}function zt(t){const e=wt(t);if(!e)return t;return`${String(e.hour).padStart(2,"0")}:${String(e.minute).padStart(2,"0")}:${String(e.second).padStart(2,"0")}`}function Tt(t,e){return new Intl.DateTimeFormat("en-CA",{timeZone:e,year:"numeric",month:"2-digit",day:"2-digit"}).format(t)}function Ot(t,e,i){const r=new Date(t);if(Number.isNaN(r.getTime()))return"";const s=new Date(e);if(Tt(r,i)===Tt(s,i))return"Hoje";const o=new Date(s.getTime()-864e5);return Tt(r,i)===Tt(o,i)?"Ontem":new Intl.DateTimeFormat("pt-BR",{timeZone:i,day:"2-digit",month:"2-digit"}).format(r)}function Ht(t){return"manual"===t?"manual":"external"===t?"ativada no dispositivo":"agendada"}function Rt(t,e){const i=new Intl.DateTimeFormat("en-US",{timeZone:e,weekday:"short"}).format(t),r=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].indexOf(i);return r>=0?r:(t.getDay()+6)%7}function Ft(t,e,i,r,s){if(e)return"warning";if(!t.enabled)return null;const o=new Date(r);if(Number.isNaN(o.getTime()))return null;if(!t.days.includes(Rt(o,s)))return null;const n=Pt(t.time);if(n<0)return null;if(function(t,e){const i=new Intl.DateTimeFormat("en-GB",{timeZone:e,hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:!1}).formatToParts(t),r=t=>Number(i.find(e=>e.type===t)?.value??0);return r("hour")%24*3600+60*r("minute")+r("second")}(o,s)<n)return"pending";const a=Tt(o,s);return i.some(e=>{const i=new Date(e.started_at);return e.schedule_id===t.id&&!Number.isNaN(i.getTime())&&Tt(i,s)===a})?"done":null}function It(t){if(!t||"object"!=typeof t)throw new Error("Configuração inválida para o card de irrigação.");const e=t.entity;if("string"!=typeof e||0===e.length||!e.startsWith("sensor."))throw new Error('O card exige um sensor da integração: "sensor.<zona>_next_run".')}class jt extends at{constructor(){super(...arguments),this._config={type:"custom:irrigation-schedule-card"},this._now=0,this._dialogOpen=!1,this._historyOpen=!1,this._settingsOpen=!1,this._focusBeforeDialog=null,this._settingsDefaultDuration="",this._settingsFlow="",this._settingsPots="",this._settingsReservoir="",this._settingsPhEntity="",this._settingsPhEntityTouched=!1,this._settingsPhMin="",this._settingsPhMax="",this._settingsEcEntity="",this._settingsEcEntityTouched=!1,this._settingsPhEntity2="",this._settingsPhEntity2Touched=!1,this._settingsPhMin2="",this._settingsPhMax2="",this._settingsEcEntity2="",this._settingsEcEntity2Touched=!1,this._settingsError=null,this._editingId=null,this._formTime="00:00",this._formDays=[],this._formDurationHour=0,this._formDurationMin=0,this._formDurationSec=0,this._formError=null,this._tickerId=null}static{this.styles=yt}static getConfigElement(){return document.createElement("irrigation-schedule-card-editor")}static getStubConfig(){return{show_next_run:gt,show_water_now:mt,compact:_t}}setConfig(t){It(t),this._config={...t}}getCardSize(){return this._config.compact?2:4}disconnectedCallback(){super.disconnectedCallback(),this._stopTicker()}updated(t){super.updated(t),this._isWatering()?null===this._tickerId&&(this._tickerId=window.setInterval(()=>{this._now=Date.now()},1e3)):null!==this._tickerId&&this._stopTicker()}render(){if(!this.hass)return this._renderConfigError("O card ainda não recebeu o objeto hass do Home Assistant.");try{if(!this._config.entity)return this._renderConfigError("Configure o card com o sensor da zona: sensor.<zona>_next_run.");if(!this._config.entity.startsWith("sensor."))return this._renderConfigError(`"${this._config.entity}" não é um sensor da integração irrigation_scheduler.`);const t=this._sensorEntity;return t?"switch_entity_id"in t.attributes&&"binary_sensor_entity_id"in t.attributes?this._renderCard(t):this._renderConfigError(`"${this._config.entity}" não é um sensor da integração irrigation_scheduler.`):this._renderConfigError(`Entidade "${this._config.entity}" não encontrada.`)}catch(t){return console.error("[irrigation-schedule-card] render failed",t),this._renderConfigError(`Falha ao renderizar o card: ${t instanceof Error?t.message:String(t)}`)}}_renderConfigError(t){return L`
      <ha-card>
        <div class="config-error">
          <ha-icon icon="mdi:alert-outline"></ha-icon>
          <div>${t}</div>
        </div>
      </ha-card>
    `}_renderCard(t){const e=this._config.compact??_t,i=this._config.show_next_run??gt,r=this._config.show_water_now??mt,s=St(),o=function(t){return[...t].sort((t,e)=>Pt(t.time)-Pt(e.time))}(function(t){if(!Array.isArray(t))return[];const e=[];for(const i of t){if(null===i||"object"!=typeof i)continue;const t=i,r="string"==typeof t.time&&null!==wt(t.time)?zt(t.time):"",s=Array.isArray(t.days)?t.days.filter(t=>"number"==typeof t&&Number.isInteger(t)&&t>=0&&t<=6):[],o="number"==typeof t.duration&&Number.isFinite(t.duration)&&t.duration>0?t.duration:0;!r||0===s.length||o<=0||e.push({id:"string"==typeof t.id?t.id:"",time:r,days:[...new Set(s)].sort((t,e)=>t-e),duration:o,enabled:"boolean"!=typeof t.enabled||t.enabled})}return e}(t.attributes.schedules)),n=this._numberAttr(t,"default_duration")??600,a=this._numberAttr(t,"flow_rate_lph")??0,l=this._numberAttr(t,"number_of_pots")??0,c=this._numberAttr(t,"reservoir_volume_l")??0,d=this._numberAttr(t,"reservoir_remaining_l")??c,h=this._stringAttr(t,"ph_entity_id")??"",u=this._numberAttr(t,"ph_min")??0,p=this._numberAttr(t,"ph_max")??14,g=this._phStatusClass(h,u,p),m=this._stringAttr(t,"ec_entity_id")??"",_=this._stringAttr(t,"ph_entity_id_2")??"",f=this._numberAttr(t,"ph_min_2")??0,v=this._numberAttr(t,"ph_max_2")??14,b=this._phStatusClass(_,f,v),y=this._stringAttr(t,"ec_entity_id_2")??"",x=this._scheduleWarnings(t),$=this._switchEid?this.hass?.states[this._switchEid]:void 0,w=this._binarySensorEid?this.hass?.states[this._binarySensorEid]:void 0,E="on"===w?.state,S="on"===$?.state,A="off"===$?.state,k=E?"Regando":S?"Agendada":"Desabilitada",D=E?"status-watering":S?"status-scheduled":"status-disabled",M=E?"mdi:water":S?"mdi:calendar-check-outline":"mdi:calendar-remove",C=this._stringAttr(w,"finishes_at"),P=this._stringAttr(w,"started_at"),N=this._stringAttr(w,"source"),z=this._now>0?new Date(this._now).toISOString():(new Date).toISOString(),T=C?function(t,e){const i=Date.parse(t),r=Date.parse(e);return Number.isFinite(i)&&Number.isFinite(r)?Math.max(0,Math.floor((i-r)/1e3)):0}(C,z):0,O=P&&C?function(t,e,i){const r=Date.parse(t),s=Date.parse(e),o=Date.parse(i);if(!Number.isFinite(r)||!Number.isFinite(s)||!Number.isFinite(o))return 0;const n=r-s;return n<=0?100:Math.min(100,Math.max(0,(o-s)/n*100))}(C,P,z):0,H=this._lastRunAttr(w),R=this._historyAttr(w),F=function(t,e,i){let r=0;for(const s of t){if(!s.enabled)continue;const t=Mt(e,s.duration,i);null!==t&&(r+=t*s.days.length)}return r/1e3/7}(o,a,l),I=function(t,e){if(!Number.isFinite(e)||e<=0)return null;const i=Number.isFinite(t)?Math.max(0,t):0;if(i<=0)return"Vazio";const r=i/e;if(r<1)return`~${Math.max(1,Math.round(24*r))} h`;return r<=60?`~${Math.max(1,Math.round(r))} dias`:`~${Math.max(1,Math.round(r/30))} meses`}(d,F),j=function(t,e,i){const r=new Date(e);if(Number.isNaN(r.getTime()))return 0;const s=Rt(r,i);return t.filter(t=>t.enabled&&t.days.includes(s)).length}(o,z,this.hass?.config?.time_zone),U=c>0?Math.min(100,Math.max(0,d/c*100)):0,B=c>0?L`
            <button
              class="refill-button"
              type="button"
              title="Reabastecer reservatório"
              aria-label="Reabastecer reservatório"
              @click=${this._refillReservoir}
            >
              <ha-icon icon="mdi:water-plus"></ha-icon>
            </button>
          `:"",V=Boolean(h||m||c>0),W=Boolean(_||y),q=V&&W;return L`
      <ha-card class=${e?"compact":""}>
        <div class="header">
            <div class="zone-icon">
              <ha-icon icon="mdi:water"></ha-icon>
            </div>
            <h2 class="header-title" title=${this._config.entity??""}>
              ${this._zoneName(t)}
            </h2>
            <span class="status ${D}">
              <ha-icon icon=${M}></ha-icon>
              ${k}
            </span>
            <div class="header-right">
              ${$?L`
                    <button
                      class="toggle ${S?"":"off"}"
                      type="button"
                      role="switch"
                      aria-checked=${S}
                      title=${"Agendamento automático: "+(S?"ativo":"desativado")}
                      aria-label="Agendamento automático"
                      @click=${()=>this._toggleMaster($,S)}
                    >
                      <span class="track"></span>
                      <span class="thumb"></span>
                    </button>
                  `:L`
                    <button
                      class="toggle off"
                      type="button"
                      role="switch"
                      aria-checked="false"
                      title="Agendamento automático: indisponível"
                      aria-label="Agendamento automático (indisponível)"
                      disabled
                    >
                      <span class="track"></span>
                      <span class="thumb"></span>
                    </button>
                  `}
              <button
                class="icon-button"
                type="button"
                title="Configurar vazão e vasos"
                aria-label="Configurar vazão e vasos"
                @click=${this._openSettings}
              >
                <ha-icon icon="mdi:cog-outline"></ha-icon>
              </button>
            </div>
        </div>

        <div class="summary">
          <div class="summary-main">
            <strong>
              ${A?"Agendamento desativado":1===j?"1 horário hoje":`${j} horários hoje`}
            </strong>
            ${!A&&i?L`<span>Próxima: ${this._nextRunText(t.state)}</span>`:""}
          </div>
          ${F>0?L`
                <div class="summary-stat">
                  <span>Volume/dia</span>
                  <strong>${kt(F)}</strong>
                </div>
              `:""}
        </div>

        ${this._renderSettings(this._zoneName(t),n,a,l,c,h,u,p,m,_,f,v,y)}

        ${H?L`
              <div class="last-run" @click=${this._openHistory}>
                <ha-icon icon="mdi:history"></ha-icon>
                <span>Última rega: ${this._lastRunText(H,z)}</span>
                <span class="schedule-row-spacer"></span>
                <ha-icon class="last-run-chevron" icon="mdi:chevron-right"></ha-icon>
              </div>
            `:""}

        ${V||W?L`
              <div class="section-divider"></div>
              <div class="card-body">
                ${q?L`
                      <div class="section-title-row">
                        <h3 class="section-title">Reservatório 1</h3>
                        <h3 class="section-title">Reservatório 2</h3>
                      </div>
                    `:L`<h3 class="section-title">Reservatório</h3>`}
                <div class="metrics">
                  ${q?L`
                        ${this._renderPhMetric(1,h,g,!0)||L`<span></span>`}
                        ${this._renderPhMetric(2,_,b,!0)||L`<span></span>`}
                        ${this._renderEcMetric(1,m,!0)||L`<span></span>`}
                        ${this._renderEcMetric(2,y,!0)||L`<span></span>`}
                      `:L`
                        ${V?L`
                              ${this._renderPhMetric(1,h,g,!1)}
                              ${this._renderEcMetric(1,m,!1)}
                            `:""}
                        ${W?L`
                              ${this._renderPhMetric(2,_,b,!1)}
                              ${this._renderEcMetric(2,y,!1)}
                            `:""}
                      `}
                </div>
                ${c>0?L`
                      <div class="reservoir-level">
                        <div class="reservoir-level-top">
                          <small>
                            Volume${I?` · restam ${I}`:""}
                          </small>
                          <strong>
                            ${function(t,e){const i=t=>Math.round(10*t)/10;return`${i(Number.isFinite(t)?Math.max(0,t):0)}/${i(Number.isFinite(e)?Math.max(0,e):0)} L`}(d,c)}
                          </strong>
                          ${B}
                        </div>
                        <div class="reservoir-level-bar">
                          <div
                            class="reservoir-level-fill"
                            style="width: ${U}%"
                          ></div>
                        </div>
                      </div>
                    `:""}
              </div>
            `:""}

        <div class="section-divider"></div>

        <div class="card-body">
          <h3 class="section-title">Agenda automática</h3>
          <div class="schedules">
            ${0===o.length?L`<div class="empty">Nenhum horário configurado.</div>`:o.map(t=>this._renderScheduleRow(t,a,l,x[t.id],R,z,this.hass?.config?.time_zone,A))}
          </div>

          <button
            class="add-schedule-button"
            type="button"
            title="Adicionar horário"
            aria-label="Adicionar horário"
            @click=${this._openAdd}
          >
            <ha-icon icon="mdi:plus"></ha-icon>
            Adicionar horário
          </button>

          ${r||E&&C?L`
                <div class="actions ${E&&C?"watering":""}">
                  ${E&&C?L`
                        <button
                          class="water-now-button stop"
                          type="button"
                          title="Parar rega"
                          aria-label="Parar rega"
                          @click=${this._stopWatering}
                        >
                          <ha-icon icon="mdi:stop"></ha-icon>
                          Parar
                        </button>
                        <div class="water-now-progress">
                          <div class="water-now-timer">
                            ${function(t){const e=Math.max(0,Math.floor(Number.isFinite(t)?t:0)),i=Math.floor(e/3600),r=Math.floor(e%3600/60),s=e%60,o=String(r).padStart(2,"0"),n=String(s).padStart(2,"0");return i>0?`${i}:${o}:${n}`:`${o}:${n}`}(T)} restantes${"external"===N?` · ${Ht(N)}`:""}
                          </div>
                          <div class="progress-track">
                            <div
                              class="progress-fill"
                              style="width: ${O}%"
                            ></div>
                          </div>
                        </div>
                      `:L`
                        <button
                          class="water-now-button"
                          type="button"
                          title="Regar agora"
                          aria-label="Regar agora"
                          ?disabled=${E}
                          @click=${this._waterNow}
                        >
                          <ha-icon icon="mdi:play"></ha-icon>
                          Regar agora
                        </button>
                      `}
                </div>
              `:""}
        </div>
      </ha-card>

      ${this._renderDialog(s,a)}
      ${this._renderHistoryDialog(R,this._zoneName(t),z)}
    `}_renderPhMetric(t,e,i,r){return e?L`
      <button
        class="metric ph-metric ${i}"
        type="button"
        title=${r?`Ver histórico do pH (reservatório ${t})`:"Ver histórico do pH"}
        @click=${()=>this._openMoreInfo(e)}
      >
        <ha-icon icon="mdi:flask"></ha-icon>
        <div class="metric-copy">
          <small>pH</small>
          <strong>
            ${this._sensorBadgeText(e,"?",t=>Nt(t))}
          </strong>
        </div>
      </button>
    `:""}_renderEcMetric(t,e,i){return e?L`
      <button
        class="metric ec-metric"
        type="button"
        title=${i?`Ver histórico da EC (reservatório ${t})`:"Ver histórico da EC"}
        @click=${()=>this._openMoreInfo(e)}
      >
        <ha-icon icon="mdi:lightning-bolt"></ha-icon>
        <div class="metric-copy">
          <small>EC</small>
          <strong>
            ${this._sensorBadgeText(e,"?",(t,e)=>Nt(t,e))}
          </strong>
        </div>
      </button>
    `:""}_renderScheduleRow(t,e,i,r,s,o,n,a){const l=Dt(e,t.duration),c=Mt(e,t.duration,i),d=Ft(t,Boolean(r),s,o,n),h=a&&"pending"===d?null:d;return L`
      <div class="schedule-row">
        <button
          class="toggle ${t.enabled?"":"off"}"
          type="button"
          role="switch"
          aria-checked=${t.enabled}
          title=${`Horário das ${Et(t.time)}: ${t.enabled?"ativo":"desativado"}`}
          aria-label=${`Horário das ${Et(t.time)}`}
          @click=${()=>this._toggleScheduleEnabled(t)}
        >
          <span class="track"></span>
          <span class="thumb"></span>
        </button>
        <div class="schedule-info">
          <div class="schedule-info-top">
            <div class="schedule-time">${Et(t.time)}</div>
            <div class="schedule-days">
              ${St().map(t=>t.charAt(0)).map((e,i)=>L`
                  <span class="day-initial ${t.days.includes(i)?"active":""}">
                    ${e}
                  </span>
                `)}
            </div>
            ${"warning"===h?L`
                  <ha-icon
                    class="warning-icon"
                    icon="mdi:alert"
                    title=${`Aviso: ${r}`}
                  ></ha-icon>
                `:"done"===h?L`
                    <ha-icon
                      class="status-icon status-done"
                      icon="mdi:check-circle"
                      title="Rega de hoje concluída"
                    ></ha-icon>
                  `:"pending"===h?L`
                      <ha-icon
                        class="status-icon status-pending"
                        icon="mdi:clock-outline"
                        title="Ainda vai regar hoje"
                      ></ha-icon>
                    `:""}
          </div>
          <div class="schedule-duration">
            ${At(t.duration)}
            ${null!==c?L`<span class="schedule-volume">· ≈ ${Ct(c)}</span>`:""}
            ${null!==c&&null!==l?L`<span class="schedule-perpot">· ${Ct(l)}/vaso</span>`:""}
          </div>
        </div>
        <div class="schedule-actions">
          <button class="row-action" type="button" title="Editar" aria-label="Editar horário" @click=${()=>this._openEdit(t)}>
            <ha-icon icon="mdi:pencil"></ha-icon>
          </button>
          <button class="row-action delete" type="button" title="Excluir" aria-label="Excluir horário" @click=${()=>this._deleteSchedule(t)}>
            <ha-icon icon="mdi:trash-can-outline"></ha-icon>
          </button>
        </div>
      </div>
    `}_renderSettings(t,e,i,r,s,o,n,a,l,c,d,h,u){if(!this._settingsOpen)return L``;const p=Math.max(1,Math.round(e/60));return L`
      <div class="overlay" @click=${this._closeSettings}>
        <div
          class="dialog settings-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="irrigation-settings-title"
          tabindex="-1"
          @keydown=${this._onDialogKeydown}
          @click=${t=>t.stopPropagation()}
        >
          <div class="dialog-header">
            <div>
              <small>Configurações</small>
              <h3 id="irrigation-settings-title">${t}</h3>
            </div>
            <button
              class="icon-button"
              type="button"
              title="Fechar"
              aria-label="Fechar"
              @click=${this._closeSettings}
            >
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          <div class="dialog-body">
            <div class="field-grid">
              <div class="field">
                <label>Duração padrão da rega (min)</label>
                <input
                  type="number"
                  min="1"
                  .value=${this._settingsDefaultDuration||String(p)}
                  @change=${this._onSettingsDefaultDurationChange}
                />
              </div>
              <div class="field">
                <label>Vazão por vaso (L/h)</label>
                <input
                  type="number"
                  min="0"
                  .value=${this._settingsFlow||String(i)}
                  @change=${this._onSettingsFlowChange}
                />
              </div>
              <div class="field">
                <label>Número de vasos</label>
                <input
                  type="number"
                  min="0"
                  .value=${this._settingsPots||String(r)}
                  @change=${this._onSettingsPotsChange}
                />
              </div>
              <div class="field">
                <label>Volume do reservatório (L)</label>
                <input
                  type="number"
                  min="0"
                  .value=${this._settingsReservoir||String(s)}
                  @change=${this._onSettingsReservoirChange}
                />
              </div>
            </div>

            <div class="dialog-divider"></div>
            <h4 class="section-title">Reservatório 1</h4>
            <div class="field">
              <label>Sensor de pH (opcional)</label>
              <input
                type="text"
                list="ph-sensor-options"
                placeholder="sensor.reservatorio_ph"
                .value=${this._settingsPhEntityTouched?this._settingsPhEntity:o}
                @change=${this._onSettingsPhEntityChange}
              />
              <datalist id="ph-sensor-options">
                ${this._sensorEntityIds().map(t=>L`<option value=${t}></option>`)}
              </datalist>
            </div>
            <div class="field">
              <label>Faixa de pH pra regar (agendado)</label>
              <div class="duration-row">
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    max="14"
                    step="0.1"
                    .value=${this._settingsPhMin||String(n)}
                    @change=${this._onSettingsPhMinChange}
                  />
                </div>
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    max="14"
                    step="0.1"
                    .value=${this._settingsPhMax||String(a)}
                    @change=${this._onSettingsPhMaxChange}
                  />
                </div>
              </div>
            </div>
            <div class="field">
              <label>Sensor de EC (opcional, só exibição)</label>
              <input
                type="text"
                list="ec-sensor-options"
                placeholder="sensor.reservatorio_ec"
                .value=${this._settingsEcEntityTouched?this._settingsEcEntity:l}
                @change=${this._onSettingsEcEntityChange}
              />
              <datalist id="ec-sensor-options">
                ${this._sensorEntityIds().map(t=>L`<option value=${t}></option>`)}
              </datalist>
            </div>

            <div class="dialog-divider"></div>
            <h4 class="section-title">Reservatório 2 (opcional)</h4>
            <div class="field">
              <label>Sensor de pH (opcional)</label>
              <input
                type="text"
                list="ph-sensor-options-2"
                placeholder="sensor.reservatorio2_ph"
                .value=${this._settingsPhEntity2Touched?this._settingsPhEntity2:c}
                @change=${this._onSettingsPhEntity2Change}
              />
              <datalist id="ph-sensor-options-2">
                ${this._sensorEntityIds().map(t=>L`<option value=${t}></option>`)}
              </datalist>
            </div>
            <div class="field">
              <label>Faixa de pH pra regar (agendado)</label>
              <div class="duration-row">
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    max="14"
                    step="0.1"
                    .value=${this._settingsPhMin2||String(d)}
                    @change=${this._onSettingsPhMin2Change}
                  />
                </div>
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    max="14"
                    step="0.1"
                    .value=${this._settingsPhMax2||String(h)}
                    @change=${this._onSettingsPhMax2Change}
                  />
                </div>
              </div>
            </div>
            <div class="field">
              <label>Sensor de EC (opcional, só exibição)</label>
              <input
                type="text"
                list="ec-sensor-options-2"
                placeholder="sensor.reservatorio2_ec"
                .value=${this._settingsEcEntity2Touched?this._settingsEcEntity2:u}
                @change=${this._onSettingsEcEntity2Change}
              />
              <datalist id="ec-sensor-options-2">
                ${this._sensorEntityIds().map(t=>L`<option value=${t}></option>`)}
              </datalist>
            </div>

            ${this._settingsError?L`<div class="form-error">${this._settingsError}</div>`:""}
          </div>
          <div class="dialog-actions">
            <button type="button" class="dialog-cancel" @click=${this._closeSettings}>
              Fechar
            </button>
            <button type="button" class="dialog-save" @click=${this._saveSettings}>Salvar</button>
          </div>
        </div>
      </div>
    `}_openSettings(){this._settingsOpen?this._closeSettings():(this._rememberDialogFocus(),this._settingsOpen=!0,this._focusOpenDialog())}_openHistory(){this._rememberDialogFocus(),this._historyOpen=!0,this._focusOpenDialog()}_closeHistory(){this._historyOpen=!1,this._restoreDialogFocus()}_closeSettings(){this._settingsOpen=!1,this._settingsDefaultDuration="",this._settingsFlow="",this._settingsPots="",this._settingsReservoir="",this._settingsPhEntity="",this._settingsPhEntityTouched=!1,this._settingsPhMin="",this._settingsPhMax="",this._settingsEcEntity="",this._settingsEcEntityTouched=!1,this._settingsPhEntity2="",this._settingsPhEntity2Touched=!1,this._settingsPhMin2="",this._settingsPhMax2="",this._settingsEcEntity2="",this._settingsEcEntity2Touched=!1,this._settingsError=null,this._restoreDialogFocus()}_onSettingsDefaultDurationChange(t){this._settingsDefaultDuration=t.target.value}_onSettingsFlowChange(t){this._settingsFlow=t.target.value}_onSettingsPotsChange(t){this._settingsPots=t.target.value}_onSettingsReservoirChange(t){this._settingsReservoir=t.target.value}_onSettingsPhEntityChange(t){this._settingsPhEntity=t.target.value.trim(),this._settingsPhEntityTouched=!0,this._settingsError=null}_onSettingsPhMinChange(t){this._settingsPhMin=t.target.value,this._settingsError=null}_onSettingsPhMaxChange(t){this._settingsPhMax=t.target.value,this._settingsError=null}_onSettingsEcEntityChange(t){this._settingsEcEntity=t.target.value.trim(),this._settingsEcEntityTouched=!0,this._settingsError=null}_onSettingsPhEntity2Change(t){this._settingsPhEntity2=t.target.value.trim(),this._settingsPhEntity2Touched=!0,this._settingsError=null}_onSettingsPhMin2Change(t){this._settingsPhMin2=t.target.value,this._settingsError=null}_onSettingsPhMax2Change(t){this._settingsPhMax2=t.target.value,this._settingsError=null}_onSettingsEcEntity2Change(t){this._settingsEcEntity2=t.target.value.trim(),this._settingsEcEntity2Touched=!0,this._settingsError=null}_saveSettings(){const t=Number.parseInt(this._settingsDefaultDuration,10),e=Number.parseInt(this._settingsFlow,10),i=Number.parseInt(this._settingsPots,10),r=Number.parseInt(this._settingsReservoir,10),s={};Number.isFinite(t)&&t>=1&&(s.default_duration=60*t),Number.isFinite(e)&&e>=0&&(s.flow_rate_lph=e),Number.isFinite(i)&&i>=0&&(s.number_of_pots=i),Number.isFinite(r)&&r>=0&&(s.reservoir_volume_l=r);const o=Number.parseFloat(this._settingsPhMin),n=Number.parseFloat(this._settingsPhMax),a=Number.isFinite(o)&&o>=0&&o<=14,l=Number.isFinite(n)&&n>=0&&n<=14,c=this._sensorEntity,d=a?o:this._numberAttr(c,"ph_min")??0,h=l?n:this._numberAttr(c,"ph_max")??14;if((a||l)&&d>h)return void(this._settingsError="O pH mínimo não pode ser maior que o pH máximo.");a&&(s.ph_min=o),l&&(s.ph_max=n),this._settingsPhEntityTouched&&(s.ph_entity_id=this._settingsPhEntity),this._settingsEcEntityTouched&&(s.ec_entity_id=this._settingsEcEntity);const u=Number.parseFloat(this._settingsPhMin2),p=Number.parseFloat(this._settingsPhMax2),g=Number.isFinite(u)&&u>=0&&u<=14,m=Number.isFinite(p)&&p>=0&&p<=14,_=g?u:this._numberAttr(c,"ph_min_2")??0,f=m?p:this._numberAttr(c,"ph_max_2")??14;(g||m)&&_>f?this._settingsError="O pH mínimo R2 não pode ser maior que o pH máximo R2.":(g&&(s.ph_min_2=u),m&&(s.ph_max_2=p),this._settingsPhEntity2Touched&&(s.ph_entity_id_2=this._settingsPhEntity2),this._settingsEcEntity2Touched&&(s.ec_entity_id_2=this._settingsEcEntity2),0!==Object.keys(s).length?this._callService("set_zone_options",s).then(()=>this._closeSettings(),t=>{this._settingsError=this._describeServiceError(t)}):this._closeSettings())}_lastRunText(t,e){const i=this.hass?.config?.time_zone,r=new Date(t.started_at),s=Ot(t.started_at,e,i),o=Number.isNaN(r.getTime())?"":new Intl.DateTimeFormat("pt-BR",{timeZone:i,hour:"2-digit",minute:"2-digit"}).format(r),n=Dt(t.flow_rate_lph,t.duration),a=[[s,o].filter(Boolean).join(" "),Ht(t.source),At(t.duration)];return null!==n&&a.push(`${Ct(n)}/vaso`),a.filter(Boolean).join(" · ")}_renderHistoryDialog(t,e,i){if(!this._historyOpen)return L``;const r=function(t,e,i){const r=new Map;for(const s of t){const t=new Date(s.started_at);if(Number.isNaN(t.getTime()))continue;const o=Tt(t,i);let n=r.get(o);n||(n={label:Ot(s.started_at,e,i),entries:[],totalMl:0,perPotMl:0},r.set(o,n)),n.entries.push(s);const a=Mt(s.flow_rate_lph,s.duration,s.number_of_pots);null!==a&&(n.totalMl+=a);const l=Dt(s.flow_rate_lph,s.duration);null!==l&&(n.perPotMl+=l)}return Array.from(r.values())}(t,i,this.hass?.config?.time_zone),s=r.reduce((t,e)=>t+e.totalMl,0);return L`
      <div class="overlay" @click=${this._closeHistory}>
        <div
          class="dialog history-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="irrigation-history-title"
          tabindex="-1"
          @keydown=${this._onDialogKeydown}
          @click=${t=>t.stopPropagation()}
        >
          <div class="dialog-header" id="irrigation-history-title">
            Histórico de regas
            <div class="history-subtitle">${e} · últimos 30 dias</div>
          </div>
          <div class="history-stats">
            <div class="history-stat">
              <span class="history-stat-value">${t.length}</span>
              <span class="history-stat-label">${1===t.length?"rega":"regas"}</span>
            </div>
            <div class="history-stat">
              <span class="history-stat-value">${Ct(s)}</span>
              <span class="history-stat-label">total no período</span>
            </div>
          </div>
          <div class="history-body">
            ${0===r.length?L`<div class="empty">Nenhuma rega registrada ainda.</div>`:r.map(t=>this._renderHistoryDayGroup(t))}
          </div>
          <div class="dialog-actions">
            <button type="button" class="dialog-cancel" @click=${this._closeHistory}>Fechar</button>
          </div>
        </div>
      </div>
    `}_renderHistoryDayGroup(t){return L`
      <div class="history-day">
        <div class="history-day-header">
          <span>${t.label}</span>
          <span class="history-day-total">
            ${t.entries.length} ${1===t.entries.length?"rega":"regas"}
            ${t.totalMl>0?L`· ${Ct(t.totalMl)}`:""}
            ${t.perPotMl>0?L` · ${Ct(t.perPotMl)}/vaso`:""}
          </span>
        </div>
        ${t.entries.map(t=>this._renderHistoryEntry(t))}
      </div>
    `}_renderHistoryEntry(t){const e=new Date(t.started_at),i=Number.isNaN(e.getTime())?"":new Intl.DateTimeFormat("pt-BR",{timeZone:this.hass?.config?.time_zone,hour:"2-digit",minute:"2-digit"}).format(e),r=Dt(t.flow_rate_lph,t.duration);return L`
      <div class="history-entry">
        <ha-icon icon=${s=t.source,"manual"===s?"mdi:hand-back-right":"external"===s?"mdi:gesture-tap-button":"mdi:calendar-clock"}></ha-icon>
        <span>${i} · ${Ht(t.source)}</span>
        <span class="schedule-row-spacer"></span>
        <span class="history-entry-detail">
          ${At(t.duration)}
          ${null!==r?L` · ${Ct(r)}/vaso`:""}
          ${"number"==typeof t.ph_value?L` · ${Nt(t.ph_value)} PH`:""}
          ${"number"==typeof t.ec_value?L` · EC ${Nt(t.ec_value,t.ec_unit??void 0)}`:""}
          ${"number"==typeof t.ph_value_2?L` · ${Nt(t.ph_value_2)} PH R2`:""}
          ${"number"==typeof t.ec_value_2?L` · EC ${Nt(t.ec_value_2,t.ec_unit_2??void 0)} R2`:""}
        </span>
      </div>
    `;var s}_renderDialog(t,e){if(!this._dialogOpen)return L``;const i=3600*this._formDurationHour+60*this._formDurationMin+this._formDurationSec,r=Dt(e,i);return L`
      <div class="overlay" @click=${this._closeDialog}>
        <div
          class="dialog schedule-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="irrigation-schedule-dialog-title"
          tabindex="-1"
          @keydown=${this._onDialogKeydown}
          @click=${t=>t.stopPropagation()}
        >
          <div class="dialog-header">
            <div>
              <small>Agenda automática</small>
              <h3 id="irrigation-schedule-dialog-title">
                ${this._editingId?"Editar horário":"Adicionar horário"}
              </h3>
            </div>
            <button
              class="icon-button"
              type="button"
              title="Fechar"
              aria-label="Fechar"
              @click=${this._closeDialog}
            >
              <ha-icon icon="mdi:close"></ha-icon>
            </button>
          </div>
          <div class="dialog-body">
            <div class="field">
              <label>Horário</label>
              <input
                type="time"
                .value=${this._formTime}
                @change=${this._onTimeChanged}
              />
            </div>
            <div class="field">
              <label>Duração</label>
              <div class="duration-box">
                <div class="duration-segment">
                  <span class="duration-segment-label">hh</span>
                  <input
                    class="duration-segment-input"
                    type="number"
                    min="0"
                    max="99"
                    .value=${String(this._formDurationHour).padStart(2,"0")}
                    @change=${this._onDurationHourChange}
                  />
                </div>
                <span class="duration-colon">:</span>
                <div class="duration-segment">
                  <span class="duration-segment-label">mm</span>
                  <input
                    class="duration-segment-input"
                    type="number"
                    min="0"
                    max="59"
                    .value=${String(this._formDurationMin).padStart(2,"0")}
                    @change=${this._onDurationMinChange}
                  />
                </div>
                <span class="duration-colon">:</span>
                <div class="duration-segment">
                  <span class="duration-segment-label">ss</span>
                  <input
                    class="duration-segment-input"
                    type="number"
                    min="0"
                    max="59"
                    .value=${String(this._formDurationSec).padStart(2,"0")}
                    @change=${this._onDurationSecChange}
                  />
                </div>
              </div>
            </div>
            <div class="duration-preview">
              <ha-icon icon="mdi:timer-outline"></ha-icon>
              <span>Regará por <strong>${At(i)}</strong></span>
            </div>
            ${null!==r?L`
                  <div class="field">
                    <label>Volume por vaso (ml)</label>
                    <input
                      type="number"
                      min="0"
                      .value=${String(Math.round(r))}
                      @change=${this._onVolumeChange}
                    />
                  </div>
                `:""}
            <fieldset class="day-fieldset">
              <legend>Dias da semana</legend>
              <div class="day-grid">
                ${t.map((t,e)=>L`
                    <label>
                      <input
                        type="checkbox"
                        ?checked=${this._formDays.includes(e)}
                        @change=${t=>this._toggleDay(e,t)}
                      />
                      <span>${t}</span>
                    </label>
                  `)}
              </div>
            </fieldset>
            ${this._formError?L`<div class="form-error">${this._formError}</div>`:""}
          </div>
          <div class="dialog-actions">
            ${this._editingId?L`
                  <button
                    class="delete-button"
                    type="button"
                    @click=${this._deleteEditingSchedule}
                  >
                    <ha-icon icon="mdi:trash-can-outline"></ha-icon>
                    Excluir
                  </button>
                `:""}
            <span class="dialog-actions-spacer"></span>
            <button type="button" class="dialog-cancel" @click=${this._closeDialog}>
              Cancelar
            </button>
            <button type="button" class="dialog-save" @click=${this._saveDialog}>Salvar</button>
          </div>
        </div>
      </div>
    `}get _sensorEntity(){const t=this._config.entity;return t?this.hass?.states[t]:void 0}get _switchEid(){return this._stringAttr(this._sensorEntity,"switch_entity_id")}get _binarySensorEid(){return this._stringAttr(this._sensorEntity,"binary_sensor_entity_id")}_isWatering(){const t=this._binarySensorEid;return!!t&&"on"===this.hass?.states[t]?.state}_stringAttr(t,e){const i=t?.attributes[e];return"string"==typeof i&&i?i:void 0}_numberAttr(t,e){const i=t?.attributes[e];return"number"==typeof i&&Number.isFinite(i)?i:void 0}_scheduleWarnings(t){const e=t?.attributes.schedule_warnings;if(!e||"object"!=typeof e)return{};const i={};for(const[t,r]of Object.entries(e))"string"==typeof r&&(i[t]=r);return i}_isHistoryRun(t){if(!t||"object"!=typeof t)return!1;const e=t;return"string"==typeof e.started_at&&!Number.isNaN(Date.parse(e.started_at))&&"number"==typeof e.duration&&Number.isFinite(e.duration)}_lastRunAttr(t){const e=t?.attributes.last_run;return this._isHistoryRun(e)?e:null}_historyAttr(t){const e=t?.attributes.history;return Array.isArray(e)?e.filter(t=>this._isHistoryRun(t)):[]}_sensorEntityIds(){return this.hass?Object.keys(this.hass.states).filter(t=>t.startsWith("sensor.")).sort():[]}_phStatusClass(t,e,i){if(!t)return"";const r=this.hass?.states[t],s=r?Number.parseFloat(r.state):Number.NaN;return Number.isFinite(s)?s>=e&&s<=i?"in-range":"out-of-range":""}_sensorBadgeText(t,e,i){const r=this.hass?.states[t],s=r?Number.parseFloat(r.state):Number.NaN;if(!Number.isFinite(s))return e;return i(s,"string"==typeof r?.attributes.unit_of_measurement?r.attributes.unit_of_measurement:void 0)}_openMoreInfo(t){this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t},bubbles:!0,composed:!0}))}_zoneName(t){const e=this._config.name;if(e&&e.trim())return e;const i=this._stringAttr(t,"friendly_name");if(!i)return this._config.entity??"";const r=[" próxima execução"," next run"," próximo horário"," proximo horario"];for(const t of r)if(i.toLowerCase().endsWith(t))return i.slice(0,i.length-t.length).trim();return i}_nextRunText(t){const e=new Date(t);return!t||Number.isNaN(e.getTime())?"Nenhum horário agendado":new Intl.DateTimeFormat("pt-BR",{timeZone:this.hass?.config?.time_zone,weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(e)}_stopTicker(){null!==this._tickerId&&(window.clearInterval(this._tickerId),this._tickerId=null),this._now=0}_callService(t,e={}){if(!this.hass||!this._config.entity)return Promise.resolve();const i=this._config.entity;return this.hass.callService(pt,t,e,{entity_id:i}).catch(e=>{throw console.error(`[irrigation-schedule-card] ${pt}.${t} failed`,e),e})}_callServiceNotifying(t,e={}){this._callService(t,e).catch(t=>{this.dispatchEvent(new CustomEvent("hass-notification",{detail:{message:this._describeServiceError(t)},bubbles:!0,composed:!0}))})}_describeServiceError(t){if(t&&"object"==typeof t&&"message"in t){const e=t.message;if("string"==typeof e&&e.trim())return e}return"Não foi possível salvar: o backend rejeitou os dados enviados."}_waterNow(){this._callServiceNotifying("water_now")}_toggleMaster(t,e){this.hass&&this.hass.callService("switch",e?"turn_off":"turn_on",{},{entity_id:t.entity_id}).catch(t=>{console.error("[irrigation-schedule-card] switch toggle failed",t)})}_stopWatering(){this._callServiceNotifying("stop")}_refillReservoir(){window.confirm("Marcar o reservatório como reabastecido (volume cheio)?")&&this._callServiceNotifying("refill_reservoir")}_toggleScheduleEnabled(t){this._callServiceNotifying("update_schedule",{id:t.id,enabled:!t.enabled})}_deleteSchedule(t){window.confirm(`Excluir o horário das ${Et(t.time)}?`)&&this._callServiceNotifying("remove_schedule",{id:t.id})}_deleteEditingSchedule(){this._editingId&&window.confirm(`Excluir o horário das ${this._formTime}?`)&&this._callService("remove_schedule",{id:this._editingId}).then(()=>this._closeDialog(),t=>{this._formError=this._describeServiceError(t)})}_openAdd(){this._rememberDialogFocus(),this._editingId=null,this._formTime="00:00",this._formDays=[],this._formDurationHour=0,this._formDurationMin=0,this._formDurationSec=0,this._formError=null,this._dialogOpen=!0,this._focusOpenDialog()}_openEdit(t){this._rememberDialogFocus(),this._editingId=t.id,this._formTime=Et(t.time),this._formDays=[...t.days];const e=Math.max(1,Math.round(t.duration));this._formDurationHour=Math.floor(e/3600),this._formDurationMin=Math.floor(e%3600/60),this._formDurationSec=e%60,this._formError=null,this._dialogOpen=!0,this._focusOpenDialog()}_closeDialog(){this._dialogOpen=!1,this._editingId=null,this._formError=null,this._restoreDialogFocus()}_rememberDialogFocus(){this._focusBeforeDialog=this.shadowRoot?.activeElement??document.activeElement}_focusOpenDialog(){this.updateComplete.then(()=>{this.shadowRoot?.querySelector('.dialog[role="dialog"]')?.focus()})}_restoreDialogFocus(){const t=this._focusBeforeDialog;this._focusBeforeDialog=null,this.updateComplete.then(()=>t?.focus())}_onDialogKeydown(t){if("Escape"===t.key)return t.preventDefault(),void(this._settingsOpen?this._closeSettings():this._historyOpen?this._closeHistory():this._closeDialog());if("Tab"!==t.key)return;const e=t.currentTarget,i=Array.from(e.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));if(0===i.length)return t.preventDefault(),void e.focus();const r=i[0],s=i[i.length-1];t.shiftKey&&this.shadowRoot?.activeElement===r?(t.preventDefault(),s.focus()):t.shiftKey||this.shadowRoot?.activeElement!==s||(t.preventDefault(),r.focus())}_saveDialog(){const t=zt(this._formTime),e=[...this._formDays].sort((t,e)=>t-e),i=3600*this._formDurationHour+60*this._formDurationMin+this._formDurationSec;if(Pt(t)<0||0===e.length||i<=0)return void(this._formError="Informe um horário, ao menos um dia e uma duração válida.");(this._editingId?this._callService("update_schedule",{id:this._editingId,time:t,days:e,duration:i}):this._callService("add_schedule",{time:t,days:e,duration:i,enabled:!0})).then(()=>this._closeDialog(),t=>{this._formError=this._describeServiceError(t)})}_onTimeChanged(t){const e=t.target.value;"string"==typeof e&&(this._formTime=e,this._formError=null)}_toggleDay(t,e){if(t<0||t>6)return;const i=e.target.checked;this._formDays=i?[...this._formDays,t]:this._formDays.filter(e=>e!==t),this._formError=null}_onDurationHourChange(t){const e=t.target.value,i=Number.parseInt(e,10);this._formDurationHour=Number.isFinite(i)&&i>=0?Math.min(99,i):0,this._formError=null}_onDurationMinChange(t){const e=t.target.value,i=Number.parseInt(e,10);this._formDurationMin=Number.isFinite(i)&&i>=0?Math.min(59,i):0,this._formError=null}_onDurationSecChange(t){const e=t.target.value,i=Number.parseInt(e,10),r=Number.isFinite(i)&&i>=0?Math.min(59,i):0;this._formDurationSec=r,this._formError=null}_onVolumeChange(t){const e=t.target.value,i=Number.parseInt(e,10),r=function(t,e){const i=Number.isFinite(t)?t:0;if(i<=0)return null;const r=(Number.isFinite(e)?Math.max(0,e):0)/1e3;return Math.round(r/i*3600)}(this._numberAttr(this._sensorEntity,"flow_rate_lph")??0,Number.isFinite(i)?i:0);null!==r&&(this._formDurationHour=Math.floor(r/3600),this._formDurationMin=Math.floor(r%3600/60),this._formDurationSec=r%60,this._formError=null)}}return e([ht({attribute:!1})],jt.prototype,"hass",void 0),e([ut()],jt.prototype,"_config",void 0),e([ut()],jt.prototype,"_now",void 0),e([ut()],jt.prototype,"_dialogOpen",void 0),e([ut()],jt.prototype,"_historyOpen",void 0),e([ut()],jt.prototype,"_settingsOpen",void 0),e([ut()],jt.prototype,"_settingsDefaultDuration",void 0),e([ut()],jt.prototype,"_settingsFlow",void 0),e([ut()],jt.prototype,"_settingsPots",void 0),e([ut()],jt.prototype,"_settingsReservoir",void 0),e([ut()],jt.prototype,"_settingsPhEntity",void 0),e([ut()],jt.prototype,"_settingsPhMin",void 0),e([ut()],jt.prototype,"_settingsPhMax",void 0),e([ut()],jt.prototype,"_settingsEcEntity",void 0),e([ut()],jt.prototype,"_settingsPhEntity2",void 0),e([ut()],jt.prototype,"_settingsPhMin2",void 0),e([ut()],jt.prototype,"_settingsPhMax2",void 0),e([ut()],jt.prototype,"_settingsEcEntity2",void 0),e([ut()],jt.prototype,"_settingsError",void 0),e([ut()],jt.prototype,"_editingId",void 0),e([ut()],jt.prototype,"_formTime",void 0),e([ut()],jt.prototype,"_formDays",void 0),e([ut()],jt.prototype,"_formDurationHour",void 0),e([ut()],jt.prototype,"_formDurationMin",void 0),e([ut()],jt.prototype,"_formDurationSec",void 0),e([ut()],jt.prototype,"_formError",void 0),customElements.get("irrigation-schedule-card")||customElements.define("irrigation-schedule-card",jt),customElements.get("irrigation-schedule-card-editor")||customElements.define("irrigation-schedule-card-editor",bt),window.customCards=window.customCards||[],window.customCards.some(t=>"irrigation-schedule-card"===t.type)||window.customCards.push({type:"irrigation-schedule-card",name:"Irrigation Scheduler",description:"Controle e agende a irrigação de uma zona (irrigation_scheduler).",preview:!1}),t.IrrigationScheduleCard=jt,t.validateCardConfig=It,t}({});
