var IrrigationScheduleCard=function(t){"use strict";function e(t,e,i,s){var r,o=arguments.length,n=o<3?e:null===s?s=Object.getOwnPropertyDescriptor(e,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)n=Reflect.decorate(t,e,i,s);else for(var a=t.length-1;a>=0;a--)(r=t[a])&&(n=(o<3?r(n):o>3?r(e,i,n):r(e,i))||n);return o>3&&n&&Object.defineProperty(e,i,n),n}"function"==typeof SuppressedError&&SuppressedError;const i=globalThis,s=i.ShadowRoot&&(void 0===i.ShadyCSS||i.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,r=Symbol(),o=new WeakMap;let n=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==r)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(s&&void 0===t){const i=void 0!==e&&1===e.length;i&&(t=o.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&o.set(e,t))}return t}toString(){return this.cssText}};const a=s?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new n("string"==typeof t?t:t+"",void 0,r))(e)})(t):t,{is:h,defineProperty:c,getOwnPropertyDescriptor:d,getOwnPropertyNames:l,getOwnPropertySymbols:u,getPrototypeOf:p}=Object,_=globalThis,g=_.trustedTypes,f=g?g.emptyScript:"",m=_.reactiveElementPolyfillSupport,$=(t,e)=>t,y={toAttribute(t,e){switch(e){case Boolean:t=t?f:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},v=(t,e)=>!h(t,e),b={attribute:!0,type:String,converter:y,reflect:!1,useDefault:!1,hasChanged:v};Symbol.metadata??=Symbol("metadata"),_.litPropertyMetadata??=new WeakMap;let w=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=b){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&c(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:r}=d(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const o=s?.call(this);r?.call(this,e),this.requestUpdate(t,o,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??b}static _$Ei(){if(this.hasOwnProperty($("elementProperties")))return;const t=p(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty($("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty($("properties"))){const t=this.properties,e=[...l(t),...u(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(a(t))}else void 0!==t&&e.push(a(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((t,e)=>{if(s)t.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const s of e){const e=document.createElement("style"),r=i.litNonce;void 0!==r&&e.setAttribute("nonce",r),e.textContent=s.cssText,t.appendChild(e)}})(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const r=(void 0!==i.converter?.toAttribute?i.converter:y).toAttribute(e,i.type);this._$Em=t,null==r?this.removeAttribute(s):this.setAttribute(s,r),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),r="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:y;this._$Em=s;const o=r.fromAttribute(e,t.type);this[s]=o??this._$Ej?.get(s)??o,this._$Em=null}}requestUpdate(t,e,i,s=!1,r){if(void 0!==t){const o=this.constructor;if(!1===s&&(r=this[t]),i??=o.getPropertyOptions(t),!((i.hasChanged??v)(r,e)||i.useDefault&&i.reflect&&r===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:r},o){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??e??this[t]),!0!==r||void 0!==o)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};w.elementStyles=[],w.shadowRootOptions={mode:"open"},w[$("elementProperties")]=new Map,w[$("finalized")]=new Map,m?.({ReactiveElement:w}),(_.reactiveElementVersions??=[]).push("2.1.2");const x=globalThis,A=t=>t,E=x.trustedTypes,S=E?E.createPolicy("lit-html",{createHTML:t=>t}):void 0,C="$lit$",k=`lit$${Math.random().toFixed(9).slice(2)}$`,D="?"+k,P=`<${D}>`,N=document,M=()=>N.createComment(""),O=t=>null===t||"object"!=typeof t&&"function"!=typeof t,T=Array.isArray,U="[ \t\n\f\r]",R=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,I=/-->/g,H=/>/g,z=RegExp(`>|${U}(?:([^\\s"'>=/]+)(${U}*=${U}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),j=/'/g,L=/"/g,W=/^(?:script|style|textarea|title)$/i,B=(t=>(e,...i)=>({_$litType$:t,strings:e,values:i}))(1),F=Symbol.for("lit-noChange"),q=Symbol.for("lit-nothing"),V=new WeakMap,J=N.createTreeWalker(N,129);function K(t,e){if(!T(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(e):e}const Q=(t,e)=>{const i=t.length-1,s=[];let r,o=2===e?"<svg>":3===e?"<math>":"",n=R;for(let e=0;e<i;e++){const i=t[e];let a,h,c=-1,d=0;for(;d<i.length&&(n.lastIndex=d,h=n.exec(i),null!==h);)d=n.lastIndex,n===R?"!--"===h[1]?n=I:void 0!==h[1]?n=H:void 0!==h[2]?(W.test(h[2])&&(r=RegExp("</"+h[2],"g")),n=z):void 0!==h[3]&&(n=z):n===z?">"===h[0]?(n=r??R,c=-1):void 0===h[1]?c=-2:(c=n.lastIndex-h[2].length,a=h[1],n=void 0===h[3]?z:'"'===h[3]?L:j):n===L||n===j?n=z:n===I||n===H?n=R:(n=z,r=void 0);const l=n===z&&t[e+1].startsWith("/>")?" ":"";o+=n===R?i+P:c>=0?(s.push(a),i.slice(0,c)+C+i.slice(c)+k+l):i+k+(-2===c?e:l)}return[K(t,o+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class Z{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let r=0,o=0;const n=t.length-1,a=this.parts,[h,c]=Q(t,e);if(this.el=Z.createElement(h,i),J.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=J.nextNode())&&a.length<n;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(C)){const e=c[o++],i=s.getAttribute(t).split(k),n=/([.?@])?(.*)/.exec(e);a.push({type:1,index:r,name:n[2],strings:i,ctor:"."===n[1]?et:"?"===n[1]?it:"@"===n[1]?st:tt}),s.removeAttribute(t)}else t.startsWith(k)&&(a.push({type:6,index:r}),s.removeAttribute(t));if(W.test(s.tagName)){const t=s.textContent.split(k),e=t.length-1;if(e>0){s.textContent=E?E.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],M()),J.nextNode(),a.push({type:2,index:++r});s.append(t[e],M())}}}else if(8===s.nodeType)if(s.data===D)a.push({type:2,index:r});else{let t=-1;for(;-1!==(t=s.data.indexOf(k,t+1));)a.push({type:7,index:r}),t+=k.length-1}r++}}static createElement(t,e){const i=N.createElement("template");return i.innerHTML=t,i}}function G(t,e,i=t,s){if(e===F)return e;let r=void 0!==s?i._$Co?.[s]:i._$Cl;const o=O(e)?void 0:e._$litDirective$;return r?.constructor!==o&&(r?._$AO?.(!1),void 0===o?r=void 0:(r=new o(t),r._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=r:i._$Cl=r),void 0!==r&&(e=G(t,r._$AS(t,e.values),r,s)),e}class X{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??N).importNode(e,!0);J.currentNode=s;let r=J.nextNode(),o=0,n=0,a=i[0];for(;void 0!==a;){if(o===a.index){let e;2===a.type?e=new Y(r,r.nextSibling,this,t):1===a.type?e=new a.ctor(r,a.name,a.strings,this,t):6===a.type&&(e=new rt(r,this,t)),this._$AV.push(e),a=i[++n]}o!==a?.index&&(r=J.nextNode(),o++)}return J.currentNode=N,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class Y{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=q,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=G(this,t,e),O(t)?t===q||null==t||""===t?(this._$AH!==q&&this._$AR(),this._$AH=q):t!==this._$AH&&t!==F&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>T(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==q&&O(this._$AH)?this._$AA.nextSibling.data=t:this.T(N.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=Z.createElement(K(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new X(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=V.get(t.strings);return void 0===e&&V.set(t.strings,e=new Z(t)),e}k(t){T(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const r of t)s===e.length?e.push(i=new Y(this.O(M()),this.O(M()),this,this.options)):i=e[s],i._$AI(r),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=A(t).nextSibling;A(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class tt{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,r){this.type=1,this._$AH=q,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=r,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=q}_$AI(t,e=this,i,s){const r=this.strings;let o=!1;if(void 0===r)t=G(this,t,e,0),o=!O(t)||t!==this._$AH&&t!==F,o&&(this._$AH=t);else{const s=t;let n,a;for(t=r[0],n=0;n<r.length-1;n++)a=G(this,s[i+n],e,n),a===F&&(a=this._$AH[n]),o||=!O(a)||a!==this._$AH[n],a===q?t=q:t!==q&&(t+=(a??"")+r[n+1]),this._$AH[n]=a}o&&!s&&this.j(t)}j(t){t===q?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class et extends tt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===q?void 0:t}}class it extends tt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==q)}}class st extends tt{constructor(t,e,i,s,r){super(t,e,i,s,r),this.type=5}_$AI(t,e=this){if((t=G(this,t,e,0)??q)===F)return;const i=this._$AH,s=t===q&&i!==q||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,r=t!==q&&(i===q||s);s&&this.element.removeEventListener(this.name,this,i),r&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class rt{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){G(this,t)}}const ot=x.litHtmlPolyfillSupport;ot?.(Z,Y),(x.litHtmlVersions??=[]).push("3.3.3");const nt=globalThis;class at extends w{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let r=s._$litPart$;if(void 0===r){const t=i?.renderBefore??null;s._$litPart$=r=new Y(e.insertBefore(M(),t),t,void 0,i??{})}return r._$AI(t),r})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return F}}at._$litElement$=!0,at.finalized=!0,nt.litElementHydrateSupport?.({LitElement:at});const ht=nt.litElementPolyfillSupport;ht?.({LitElement:at}),(nt.litElementVersions??=[]).push("4.2.2");const ct={attribute:!0,type:String,converter:y,reflect:!1,hasChanged:v},dt=(t=ct,e,i)=>{const{kind:s,metadata:r}=i;let o=globalThis.litPropertyMetadata.get(r);if(void 0===o&&globalThis.litPropertyMetadata.set(r,o=new Map),"setter"===s&&((t=Object.create(t)).wrapped=!0),o.set(i.name,t),"accessor"===s){const{name:s}=i;return{set(i){const r=e.get.call(this);e.set.call(this,i),this.requestUpdate(s,r,t,!0,i)},init(e){return void 0!==e&&this.C(s,void 0,t,e),e}}}if("setter"===s){const{name:s}=i;return function(i){const r=this[s];e.call(this,i),this.requestUpdate(s,r,t,!0,i)}}throw Error("Unsupported decorator location: "+s)};function lt(t){return(e,i)=>"object"==typeof i?dt(t,e,i):((t,e,i)=>{const s=e.hasOwnProperty(i);return e.constructor.createProperty(i,t),s?Object.getOwnPropertyDescriptor(e,i):void 0})(t,e,i)}function ut(t){return lt({...t,state:!0,attribute:!1})}const pt="irrigation_scheduler",_t=!0,gt=!0,ft=!1,mt=[{name:"entity",selector:{entity:{domain:"sensor"}}},{name:"name",selector:{text:{}}},{name:"show_next_run",selector:{boolean:{}}},{name:"show_water_now",selector:{boolean:{}}},{name:"compact",selector:{boolean:{}}}],$t={entity:"Entidade (sensor.<zona>_next_run)",name:"Nome",show_next_run:"Mostrar próximo horário",show_water_now:"Mostrar regar agora",compact:"Compacto"};class yt extends at{constructor(){super(...arguments),this._computeLabel=t=>$t[t.name]??t.name}render(){return this.hass&&this.config?B`
      <ha-form
        .hass=${this.hass}
        .data=${this.config}
        .schema=${mt}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `:B``}_valueChanged(t){const e=t.detail,i=e?.name;if(!i||!this.config)return;const s={...this.config,[i]:e.value};this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:s},bubbles:!0,composed:!0}))}}e([lt({attribute:!1})],yt.prototype,"hass",void 0),e([lt({attribute:!1})],yt.prototype,"config",void 0);const vt=((t,...e)=>{const i=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new n(i,t,r)})`
  ha-card {
    overflow: hidden;
  }

  .card-body {
    padding: 0 16px 16px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 16px 16px 8px;
  }

  .header-title {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--primary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .status {
    font-size: 0.75rem;
    line-height: 1;
    padding: 4px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .status-watering {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }

  .status-scheduled {
    background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
    color: var(--primary-text-color);
  }

  .status-disabled {
    background: var(--error-color, #db4437);
    color: var(--text-primary-color, #fff);
  }

  .next-run {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 16px;
    font-size: 0.85rem;
    color: var(--secondary-text-color);
  }

  .watering-bar {
    padding: 8px 16px;
    background: rgba(3, 169, 244, 0.08);
  }

  .watering-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .watering-left {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .watering-remaining {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--primary-color, #03a9f4);
  }

  .progress-track {
    height: 6px;
    border-radius: 3px;
    background: var(--divider-color, rgba(0, 0, 0, 0.12));
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--primary-color, #03a9f4);
    transition: width 1s linear;
  }

  .watering-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .schedules {
    margin-top: 8px;
  }

  .schedule-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
  }

  .schedule-row:last-child {
    border-bottom: none;
  }

  .schedule-time {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    min-width: 52px;
  }

  .schedule-days {
    display: flex;
    gap: 4px;
    flex: 1;
    flex-wrap: wrap;
  }

  .day-chip {
    font-size: 0.7rem;
    padding: 2px 5px;
    border-radius: 4px;
    background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
    color: var(--secondary-text-color);
  }

  .schedule-duration {
    font-size: 0.85rem;
    color: var(--secondary-text-color);
    white-space: nowrap;
  }

  .schedule-actions {
    display: flex;
    align-items: center;
  }

  .empty {
    padding: 16px 0;
    text-align: center;
    color: var(--secondary-text-color);
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }

  .config-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    color: var(--error-color, #db4437);
    font-size: 0.9rem;
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 8px 0;
    min-width: 280px;
  }

  .day-picker {
    display: grid;
    grid-template-columns: repeat(7, auto);
    gap: 4px;
    justify-content: start;
  }

  .day-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 0.7rem;
    color: var(--secondary-text-color);
    cursor: pointer;
  }

  .form-error {
    color: var(--error-color, #db4437);
    font-size: 0.8rem;
  }

  .compact .card-body {
    padding: 0 12px 12px;
  }

  .compact .header {
    padding: 12px 12px 4px;
  }

  .compact .schedule-days,
  .compact .next-run {
    display: none;
  }
`,bt=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"],wt=/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;function xt(t){const e=wt.exec(t);if(!e)return null;const i=Number(e[1]),s=Number(e[2]),r=e[3]?Number(e[3]):0;return i>23||s>59||r>59?null:{hour:i,minute:s,second:r}}function At(t){const e=xt(t);if(!e)return t;const i=t.slice(0,t.indexOf(":")),s=String(e.minute).padStart(2,"0");return e.second>0?`${i}:${s}:${String(e.second).padStart(2,"0")}`:`${i}:${s}`}function Et(t){const e=Math.max(0,Math.round(Number.isFinite(t)?t:0));if(e<60)return`${e} s`;const i=Math.round(e/60),s=Math.floor(i/60),r=i%60,o=[];return s>0&&o.push(`${s} h`),r>0&&o.push(`${r} min`),o.join(" ")}function St(t){const e=xt(t);if(!e)return t;return`${String(e.hour).padStart(2,"0")}:${String(e.minute).padStart(2,"0")}:${String(e.second).padStart(2,"0")}`}function Ct(t){if(!t||"object"!=typeof t)throw new Error("Configuração inválida para o card de irrigação.");const e=t.entity;if("string"!=typeof e||0===e.length||!e.startsWith("sensor."))throw new Error('O card exige um sensor da integração: "sensor.<zona>_next_run".')}class kt extends at{constructor(){super(...arguments),this._config={type:"custom:irrigation-schedule-card"},this._now=0,this._dialogOpen=!1,this._editingId=null,this._formTime="06:00",this._formDays=[],this._formDuration=15,this._formError=!1,this._tickerId=null}static{this.styles=vt}static getConfigElement(){return document.createElement("irrigation-schedule-card-editor")}static getStubConfig(){return{show_next_run:_t,show_water_now:gt,compact:ft}}setConfig(t){Ct(t),this._config={...t}}getCardSize(){return this._config.compact?2:4}disconnectedCallback(){super.disconnectedCallback(),this._stopTicker()}updated(t){super.updated(t),this._isWatering()?null===this._tickerId&&(this._tickerId=window.setInterval(()=>{this._now=Date.now()},1e3)):null!==this._tickerId&&this._stopTicker()}render(){if(!this._config.entity)return this._renderConfigError("Configure o card com o sensor da zona: sensor.<zona>_next_run.");if(!this._config.entity.startsWith("sensor."))return this._renderConfigError(`"${this._config.entity}" não é um sensor da integração irrigation_scheduler.`);const t=this._sensorEntity;return t?this._renderCard(t):this._renderConfigError(`Entidade "${this._config.entity}" não encontrada.`)}_renderConfigError(t){return B`
      <ha-card>
        <div class="config-error">
          <ha-icon icon="mdi:alert-outline"></ha-icon>
          <div>${t}</div>
        </div>
      </ha-card>
    `}_renderCard(t){const e=this._config.compact??ft,i=this._config.show_next_run??_t,s=this._config.show_water_now??gt,r=this._locale(),o=function(t){if(!t||t.toLowerCase().startsWith("pt"))return[...bt];const e=new Intl.DateTimeFormat(t,{weekday:"short"});return Array.from({length:7},(t,i)=>{const s=new Date(2e3,0,3+i,12,0,0);return e.format(s).replace(/\.$/,"")})}(r),n=function(t){if(!Array.isArray(t))return[];const e=[];for(const i of t){if(null===i||"object"!=typeof i)continue;const t=i,s="string"==typeof t.time&&null!==xt(t.time)?St(t.time):"",r=Array.isArray(t.days)?t.days.filter(t=>"number"==typeof t&&Number.isInteger(t)&&t>=0&&t<=6):[],o="number"==typeof t.duration&&Number.isFinite(t.duration)&&t.duration>0?t.duration:0;!s||0===r.length||o<=0||e.push({id:"string"==typeof t.id?t.id:"",time:s,days:[...new Set(r)].sort((t,e)=>t-e),duration:o,enabled:"boolean"!=typeof t.enabled||t.enabled})}return e}(t.attributes.schedules),a=this._numberAttr(t,"default_duration")??0,h=this._switchEid?this.hass?.states[this._switchEid]:void 0,c=this._binarySensorEid?this.hass?.states[this._binarySensorEid]:void 0,d="on"===c?.state,l="on"===h?.state,u=d?"Regando":l?"Agendada":"Desabilitada",p=d?"status-watering":l?"status-scheduled":"status-disabled",_=this._stringAttr(c,"finishes_at"),g=this._stringAttr(c,"started_at"),f=this._now>0?new Date(this._now).toISOString():(new Date).toISOString(),m=_?function(t,e){const i=Date.parse(t),s=Date.parse(e);return Number.isFinite(i)&&Number.isFinite(s)?Math.max(0,Math.floor((i-s)/1e3)):0}(_,f):0,$=g&&_?function(t,e,i){const s=Date.parse(t),r=Date.parse(e),o=Date.parse(i);if(!Number.isFinite(s)||!Number.isFinite(r)||!Number.isFinite(o))return 0;const n=s-r;return n<=0?100:Math.min(100,Math.max(0,(o-r)/n*100))}(_,g,f):0,y=a>0?`Regar agora por ${Et(a)}`:"Regar agora";return B`
      <ha-card class=${e?"compact":""}>
        <div class="header">
          <div class="header-title" title=${this._config.entity??""}>
            ${this._zoneName(t)}
          </div>
          <div class="header-right">
            <span class="status ${p}">${u}</span>
            ${h?B`
                  <ha-entity-toggle
                    .hass=${this.hass}
                    .entity=${h}
                  ></ha-entity-toggle>
                `:B`<ha-switch disabled></ha-switch>`}
          </div>
        </div>

        ${d&&_?B`
              <div class="watering-bar">
                <div class="watering-info">
                  <div class="watering-left">
                    <ha-icon icon="mdi:sprinkler-variant"></ha-icon>
                    <span>Regando</span>
                  </div>
                  <div class="watering-remaining">
                    ${function(t){const e=Math.max(0,Math.floor(Number.isFinite(t)?t:0)),i=Math.floor(e/3600),s=Math.floor(e%3600/60),r=e%60,o=String(s).padStart(2,"0"),n=String(r).padStart(2,"0");return i>0?`${i}:${o}:${n}`:`${o}:${n}`}(m)}
                  </div>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    style="width: ${$}%"
                  ></div>
                </div>
                <div class="watering-actions">
                  <ha-button outlined @click=${this._stopWatering}>
                    <ha-icon icon="mdi:stop"></ha-icon>
                    Parar
                  </ha-button>
                </div>
              </div>
            `:""}

        ${!d&&i?B`
              <div class="next-run">
                <ha-icon icon="mdi:clock-start"></ha-icon>
                <span>Próximo: ${this._nextRunText(t.state,r)}</span>
              </div>
            `:""}

        <div class="card-body">
          <div class="schedules">
            ${0===n.length?B`<div class="empty">Nenhum horário configurado.</div>`:n.map(t=>this._renderScheduleRow(t,o))}
          </div>

          <div class="actions">
            <ha-button outlined @click=${this._openAdd}>
              <ha-icon icon="mdi:plus"></ha-icon>
              Adicionar horário
            </ha-button>
            ${s?B`
                  <ha-button
                    raised
                    ?disabled=${d}
                    @click=${this._waterNow}
                  >
                    ${y}
                  </ha-button>
                `:""}
          </div>
        </div>
      </ha-card>

      ${this._renderDialog(o)}
    `}_renderScheduleRow(t,e){return B`
      <div class="schedule-row">
        <div class="schedule-time">${At(t.time)}</div>
        <div class="schedule-days">
          ${t.days.map(t=>B`<span class="day-chip">${e[t]??""}</span>`)}
        </div>
        <div class="schedule-duration">
          ${Et(t.duration)}
        </div>
        <ha-switch
          ?checked=${t.enabled}
          @change=${e=>this._toggleScheduleEnabled(t,e)}
        ></ha-switch>
        <div class="schedule-actions">
          <ha-icon-button
            title="Editar"
            @click=${()=>this._openEdit(t)}
          >
            <ha-icon icon="mdi:pencil"></ha-icon>
          </ha-icon-button>
          <ha-icon-button
            title="Excluir"
            @click=${()=>this._deleteSchedule(t)}
          >
            <ha-icon icon="mdi:delete"></ha-icon>
          </ha-icon-button>
        </div>
      </div>
    `}_renderDialog(t){return B`
      <ha-dialog
        ?open=${this._dialogOpen}
        .heading=${this._editingId?"Editar horário":"Adicionar horário"}
        @closed=${this._closeDialog}
      >
        <div class="dialog-body">
          <ha-time-input
            label="Horário"
            .value=${this._formTime}
            @value-changed=${this._onTimeChanged}
          ></ha-time-input>
          <div class="day-picker">
            ${t.map((t,e)=>B`
                <label class="day-option">
                  <ha-checkbox
                    ?checked=${this._formDays.includes(e)}
                    @change=${t=>this._toggleDay(e,t)}
                  ></ha-checkbox>
                  <span>${t}</span>
                </label>
              `)}
          </div>
          <ha-textfield
            label="Duração (minutos)"
            type="number"
            min="1"
            .value=${String(this._formDuration)}
            @change=${this._onDurationChange}
          ></ha-textfield>
          ${this._formError?B`
                <div class="form-error">
                  Informe um horário, ao menos um dia e uma duração válida.
                </div>
              `:""}
        </div>
        <ha-button slot="secondaryAction" @click=${this._closeDialog}>
          Cancelar
        </ha-button>
        <ha-button slot="primaryAction" @click=${this._saveDialog}>
          Salvar
        </ha-button>
      </ha-dialog>
    `}get _sensorEntity(){const t=this._config.entity;return t?this.hass?.states[t]:void 0}get _switchEid(){return this._stringAttr(this._sensorEntity,"switch_entity_id")}get _binarySensorEid(){return this._stringAttr(this._sensorEntity,"binary_sensor_entity_id")}_isWatering(){const t=this._binarySensorEid;return!!t&&"on"===this.hass?.states[t]?.state}_stringAttr(t,e){const i=t?.attributes[e];return"string"==typeof i&&i?i:void 0}_numberAttr(t,e){const i=t?.attributes[e];return"number"==typeof i&&Number.isFinite(i)?i:void 0}_zoneName(t){const e=this._config.name;if(e&&e.trim())return e;const i=this._stringAttr(t,"friendly_name");if(!i)return this._config.entity??"";const s=[" próxima execução"," next run"," próximo horário"," proximo horario"];for(const t of s)if(i.toLowerCase().endsWith(t))return i.slice(0,i.length-t.length).trim();return i}_locale(){return this.hass?.locale?.language||this.hass?.language||"pt-BR"}_nextRunText(t,e){const i=new Date(t);return!t||Number.isNaN(i.getTime())?"Nenhum horário agendado":new Intl.DateTimeFormat(e,{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(i)}_stopTicker(){null!==this._tickerId&&(window.clearInterval(this._tickerId),this._tickerId=null),this._now=0}_callService(t,e={}){if(!this.hass)return;const i=this._config.entity;i&&this.hass.callService(pt,t,e,{entity_id:i}).catch(e=>{console.error(`[irrigation-schedule-card] ${pt}.${t} failed`,e)})}_waterNow(){this._callService("water_now")}_stopWatering(){this._callService("stop")}_toggleScheduleEnabled(t,e){const i=e.target.checked;this._callService("update_schedule",{id:t.id,enabled:i})}_deleteSchedule(t){window.confirm(`Excluir o horário das ${At(t.time)}?`)&&this._callService("remove_schedule",{id:t.id})}_openAdd(){this._editingId=null,this._formTime="06:00",this._formDays=[],this._formDuration=this._defaultDurationMinutes(),this._formError=!1,this._dialogOpen=!0}_openEdit(t){this._editingId=t.id,this._formTime=At(t.time),this._formDays=[...t.days],this._formDuration=Math.max(1,Math.round(t.duration/60)),this._formError=!1,this._dialogOpen=!0}_closeDialog(){this._dialogOpen=!1,this._editingId=null,this._formError=!1}_saveDialog(){const t=St(this._formTime),e=[...this._formDays].sort((t,e)=>t-e),i=60*this._formDuration;(function(t){const e=xt(t);return e?3600*e.hour+60*e.minute+e.second:-1})(t)<0||0===e.length||i<=0?this._formError=!0:(this._editingId?this._callService("update_schedule",{id:this._editingId,time:t,days:e,duration:i}):this._callService("add_schedule",{time:t,days:e,duration:i,enabled:!0}),this._closeDialog())}_onTimeChanged(t){const e=t.detail,i=e?.value;"string"==typeof i&&(this._formTime=i,this._formError=!1)}_toggleDay(t,e){if(t<0||t>6)return;const i=e.target.checked;this._formDays=i?[...this._formDays,t]:this._formDays.filter(e=>e!==t),this._formError=!1}_onDurationChange(t){const e=t.target.value,i=Number.parseInt(e,10);this._formDuration=Number.isFinite(i)&&i>0?i:0,this._formError=!1}_defaultDurationMinutes(){const t=this._numberAttr(this._sensorEntity,"default_duration");return!t||t<60?15:Math.max(1,Math.round(t/60))}}return e([lt({attribute:!1})],kt.prototype,"hass",void 0),e([ut()],kt.prototype,"_config",void 0),e([ut()],kt.prototype,"_now",void 0),e([ut()],kt.prototype,"_dialogOpen",void 0),e([ut()],kt.prototype,"_editingId",void 0),e([ut()],kt.prototype,"_formTime",void 0),e([ut()],kt.prototype,"_formDays",void 0),e([ut()],kt.prototype,"_formDuration",void 0),e([ut()],kt.prototype,"_formError",void 0),customElements.get("irrigation-schedule-card")||customElements.define("irrigation-schedule-card",kt),customElements.get("irrigation-schedule-card-editor")||customElements.define("irrigation-schedule-card-editor",yt),window.customCards=window.customCards||[],window.customCards.some(t=>"irrigation-schedule-card"===t.type)||window.customCards.push({type:"irrigation-schedule-card",name:"Irrigation Scheduler",description:"Controle e agende a irrigação de uma zona (irrigation_scheduler).",preview:!1}),t.IrrigationScheduleCard=kt,t.validateCardConfig=Ct,t}({});
