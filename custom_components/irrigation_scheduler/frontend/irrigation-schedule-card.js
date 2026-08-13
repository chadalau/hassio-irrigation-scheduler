var IrrigationScheduleCard=function(t){"use strict";function e(t,e,i,s){var r,n=arguments.length,o=n<3?e:null===s?s=Object.getOwnPropertyDescriptor(e,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(t,e,i,s);else for(var a=t.length-1;a>=0;a--)(r=t[a])&&(o=(n<3?r(o):n>3?r(e,i,o):r(e,i))||o);return n>3&&o&&Object.defineProperty(e,i,o),o}"function"==typeof SuppressedError&&SuppressedError;const i=globalThis,s=i.ShadowRoot&&(void 0===i.ShadyCSS||i.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,r=Symbol(),n=new WeakMap;let o=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==r)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(s&&void 0===t){const i=void 0!==e&&1===e.length;i&&(t=n.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&n.set(e,t))}return t}toString(){return this.cssText}};const a=s?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new o("string"==typeof t?t:t+"",void 0,r))(e)})(t):t,{is:l,defineProperty:c,getOwnPropertyDescriptor:d,getOwnPropertyNames:h,getOwnPropertySymbols:u,getPrototypeOf:p}=Object,g=globalThis,m=g.trustedTypes,_=m?m.emptyScript:"",f=g.reactiveElementPolyfillSupport,v=(t,e)=>t,y={toAttribute(t,e){switch(e){case Boolean:t=t?_:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},b=(t,e)=>!l(t,e),$={attribute:!0,type:String,converter:y,reflect:!1,useDefault:!1,hasChanged:b};Symbol.metadata??=Symbol("metadata"),g.litPropertyMetadata??=new WeakMap;let x=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=$){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&c(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:r}=d(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const n=s?.call(this);r?.call(this,e),this.requestUpdate(t,n,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??$}static _$Ei(){if(this.hasOwnProperty(v("elementProperties")))return;const t=p(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(v("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(v("properties"))){const t=this.properties,e=[...h(t),...u(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(a(t))}else void 0!==t&&e.push(a(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((t,e)=>{if(s)t.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const s of e){const e=document.createElement("style"),r=i.litNonce;void 0!==r&&e.setAttribute("nonce",r),e.textContent=s.cssText,t.appendChild(e)}})(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const r=(void 0!==i.converter?.toAttribute?i.converter:y).toAttribute(e,i.type);this._$Em=t,null==r?this.removeAttribute(s):this.setAttribute(s,r),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),r="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:y;this._$Em=s;const n=r.fromAttribute(e,t.type);this[s]=n??this._$Ej?.get(s)??n,this._$Em=null}}requestUpdate(t,e,i,s=!1,r){if(void 0!==t){const n=this.constructor;if(!1===s&&(r=this[t]),i??=n.getPropertyOptions(t),!((i.hasChanged??b)(r,e)||i.useDefault&&i.reflect&&r===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:r},n){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),!0!==r||void 0!==n)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};x.elementStyles=[],x.shadowRootOptions={mode:"open"},x[v("elementProperties")]=new Map,x[v("finalized")]=new Map,f?.({ReactiveElement:x}),(g.reactiveElementVersions??=[]).push("2.1.2");const w=globalThis,E=t=>t,S=w.trustedTypes,A=S?S.createPolicy("lit-html",{createHTML:t=>t}):void 0,C="$lit$",M=`lit$${Math.random().toFixed(9).slice(2)}$`,P="?"+M,k=`<${P}>`,N=document,D=()=>N.createComment(""),T=t=>null===t||"object"!=typeof t&&"function"!=typeof t,z=Array.isArray,R="[ \t\n\f\r]",H=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,O=/-->/g,F=/>/g,I=RegExp(`>|${R}(?:([^\\s"'>=/]+)(${R}*=${R}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),j=/'/g,U=/"/g,L=/^(?:script|style|textarea|title)$/i,B=(t=>(e,...i)=>({_$litType$:t,strings:e,values:i}))(1),W=Symbol.for("lit-noChange"),V=Symbol.for("lit-nothing"),q=new WeakMap,Z=N.createTreeWalker(N,129);function G(t,e){if(!z(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==A?A.createHTML(e):e}const J=(t,e)=>{const i=t.length-1,s=[];let r,n=2===e?"<svg>":3===e?"<math>":"",o=H;for(let e=0;e<i;e++){const i=t[e];let a,l,c=-1,d=0;for(;d<i.length&&(o.lastIndex=d,l=o.exec(i),null!==l);)d=o.lastIndex,o===H?"!--"===l[1]?o=O:void 0!==l[1]?o=F:void 0!==l[2]?(L.test(l[2])&&(r=RegExp("</"+l[2],"g")),o=I):void 0!==l[3]&&(o=I):o===I?">"===l[0]?(o=r??H,c=-1):void 0===l[1]?c=-2:(c=o.lastIndex-l[2].length,a=l[1],o=void 0===l[3]?I:'"'===l[3]?U:j):o===U||o===j?o=I:o===O||o===F?o=H:(o=I,r=void 0);const h=o===I&&t[e+1].startsWith("/>")?" ":"";n+=o===H?i+k:c>=0?(s.push(a),i.slice(0,c)+C+i.slice(c)+M+h):i+M+(-2===c?e:h)}return[G(t,n+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class K{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let r=0,n=0;const o=t.length-1,a=this.parts,[l,c]=J(t,e);if(this.el=K.createElement(l,i),Z.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=Z.nextNode())&&a.length<o;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(C)){const e=c[n++],i=s.getAttribute(t).split(M),o=/([.?@])?(.*)/.exec(e);a.push({type:1,index:r,name:o[2],strings:i,ctor:"."===o[1]?et:"?"===o[1]?it:"@"===o[1]?st:tt}),s.removeAttribute(t)}else t.startsWith(M)&&(a.push({type:6,index:r}),s.removeAttribute(t));if(L.test(s.tagName)){const t=s.textContent.split(M),e=t.length-1;if(e>0){s.textContent=S?S.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],D()),Z.nextNode(),a.push({type:2,index:++r});s.append(t[e],D())}}}else if(8===s.nodeType)if(s.data===P)a.push({type:2,index:r});else{let t=-1;for(;-1!==(t=s.data.indexOf(M,t+1));)a.push({type:7,index:r}),t+=M.length-1}r++}}static createElement(t,e){const i=N.createElement("template");return i.innerHTML=t,i}}function Q(t,e,i=t,s){if(e===W)return e;let r=void 0!==s?i._$Co?.[s]:i._$Cl;const n=T(e)?void 0:e._$litDirective$;return r?.constructor!==n&&(r?._$AO?.(!1),void 0===n?r=void 0:(r=new n(t),r._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=r:i._$Cl=r),void 0!==r&&(e=Q(t,r._$AS(t,e.values),r,s)),e}class X{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??N).importNode(e,!0);Z.currentNode=s;let r=Z.nextNode(),n=0,o=0,a=i[0];for(;void 0!==a;){if(n===a.index){let e;2===a.type?e=new Y(r,r.nextSibling,this,t):1===a.type?e=new a.ctor(r,a.name,a.strings,this,t):6===a.type&&(e=new rt(r,this,t)),this._$AV.push(e),a=i[++o]}n!==a?.index&&(r=Z.nextNode(),n++)}return Z.currentNode=N,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class Y{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=V,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=Q(this,t,e),T(t)?t===V||null==t||""===t?(this._$AH!==V&&this._$AR(),this._$AH=V):t!==this._$AH&&t!==W&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>z(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==V&&T(this._$AH)?this._$AA.nextSibling.data=t:this.T(N.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=K.createElement(G(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new X(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=q.get(t.strings);return void 0===e&&q.set(t.strings,e=new K(t)),e}k(t){z(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const r of t)s===e.length?e.push(i=new Y(this.O(D()),this.O(D()),this,this.options)):i=e[s],i._$AI(r),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=E(t).nextSibling;E(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class tt{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,r){this.type=1,this._$AH=V,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=r,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=V}_$AI(t,e=this,i,s){const r=this.strings;let n=!1;if(void 0===r)t=Q(this,t,e,0),n=!T(t)||t!==this._$AH&&t!==W,n&&(this._$AH=t);else{const s=t;let o,a;for(t=r[0],o=0;o<r.length-1;o++)a=Q(this,s[i+o],e,o),a===W&&(a=this._$AH[o]),n||=!T(a)||a!==this._$AH[o],a===V?t=V:t!==V&&(t+=(a??"")+r[o+1]),this._$AH[o]=a}n&&!s&&this.j(t)}j(t){t===V?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class et extends tt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===V?void 0:t}}class it extends tt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==V)}}class st extends tt{constructor(t,e,i,s,r){super(t,e,i,s,r),this.type=5}_$AI(t,e=this){if((t=Q(this,t,e,0)??V)===W)return;const i=this._$AH,s=t===V&&i!==V||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,r=t!==V&&(i===V||s);s&&this.element.removeEventListener(this.name,this,i),r&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class rt{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){Q(this,t)}}const nt=w.litHtmlPolyfillSupport;nt?.(K,Y),(w.litHtmlVersions??=[]).push("3.3.3");const ot=globalThis;class at extends x{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let r=s._$litPart$;if(void 0===r){const t=i?.renderBefore??null;s._$litPart$=r=new Y(e.insertBefore(D(),t),t,void 0,i??{})}return r._$AI(t),r})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return W}}at._$litElement$=!0,at.finalized=!0,ot.litElementHydrateSupport?.({LitElement:at});const lt=ot.litElementPolyfillSupport;lt?.({LitElement:at}),(ot.litElementVersions??=[]).push("4.2.2");const ct={attribute:!0,type:String,converter:y,reflect:!1,hasChanged:b},dt=(t=ct,e,i)=>{const{kind:s,metadata:r}=i;let n=globalThis.litPropertyMetadata.get(r);if(void 0===n&&globalThis.litPropertyMetadata.set(r,n=new Map),"setter"===s&&((t=Object.create(t)).wrapped=!0),n.set(i.name,t),"accessor"===s){const{name:s}=i;return{set(i){const r=e.get.call(this);e.set.call(this,i),this.requestUpdate(s,r,t,!0,i)},init(e){return void 0!==e&&this.C(s,void 0,t,e),e}}}if("setter"===s){const{name:s}=i;return function(i){const r=this[s];e.call(this,i),this.requestUpdate(s,r,t,!0,i)}}throw Error("Unsupported decorator location: "+s)};function ht(t){return(e,i)=>"object"==typeof i?dt(t,e,i):((t,e,i)=>{const s=e.hasOwnProperty(i);return e.constructor.createProperty(i,t),s?Object.getOwnPropertyDescriptor(e,i):void 0})(t,e,i)}function ut(t){return ht({...t,state:!0,attribute:!1})}const pt="irrigation_scheduler",gt=!0,mt=!0,_t=!1,ft=[{name:"entity",selector:{entity:{domain:"sensor"}}},{name:"name",selector:{text:{}}},{name:"show_next_run",selector:{boolean:{}}},{name:"show_water_now",selector:{boolean:{}}},{name:"compact",selector:{boolean:{}}}],vt={entity:"Entidade (sensor.<zona>_next_run)",name:"Nome",show_next_run:"Mostrar próximo horário",show_water_now:"Mostrar regar agora",compact:"Compacto"};class yt extends at{constructor(){super(...arguments),this._computeLabel=t=>vt[t.name]??t.name}setConfig(t){this._config=t}render(){return this.hass&&this._config?B`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${ft}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `:B``}_valueChanged(t){const e=t.detail?.value;if(!e||!this._config)return;const i={...this._config,...e};this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i},bubbles:!0,composed:!0}))}}e([ht({attribute:!1})],yt.prototype,"hass",void 0),e([ut()],yt.prototype,"_config",void 0);const bt=((t,...e)=>{const i=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new o(i,t,r)})`
  ha-card {
    overflow: hidden;
  }

  .card-body {
    padding: 0 16px 16px;
  }

  .header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 16px 16px 8px;
  }

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .header-badges {
    display: inline-grid;
    grid-template-columns: auto auto auto auto auto auto;
    column-gap: 3px;
    row-gap: 2px;
    align-items: center;
    justify-items: start;
    justify-content: start;
  }

  .reservoir-estimate {
    font-size: 0.7rem;
    color: var(--secondary-text-color);
    white-space: nowrap;
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

  .reservoir-label {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--secondary-background-color, rgba(255, 255, 255, 0.08));
    color: var(--warning-color, #ff9800);
    font-size: 0.7rem;
    font-weight: 600;
  }

  .header-title {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--primary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .sensor-badge {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border: none;
    border-radius: 999px;
    background: rgba(3, 169, 244, 0.16);
    color: var(--primary-color, #03a9f4);
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .sensor-badge:hover {
    filter: brightness(1.15);
  }

  .sensor-badge.in-range {
    background: rgba(76, 175, 80, 0.18);
    color: var(--success-color, #4caf50);
  }

  .sensor-badge.out-of-range {
    background: rgba(244, 67, 54, 0.18);
    color: var(--error-color, #f44336);
  }

  .sensor-badge.volume-badge {
    background: var(--secondary-background-color, rgba(255, 255, 255, 0.08));
    color: var(--secondary-text-color);
    cursor: default;
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
    padding: 2px 16px;
    font-size: 0.85rem;
    color: var(--secondary-text-color);
  }

  .last-run {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 16px;
    font-size: 0.85rem;
    color: var(--secondary-text-color);
    cursor: pointer;
  }

  .last-run:hover {
    color: var(--primary-text-color);
  }

  .last-run-chevron {
    --mdc-icon-size: 18px;
    flex-shrink: 0;
  }

  .section-divider {
    height: 1px;
    background: var(--divider-color, rgba(0, 0, 0, 0.12));
    margin: 8px 16px 0;
  }

  .card-body .section-divider {
    /* .card-body already has its own 16px side padding: no extra inset. */
    margin-left: 0;
    margin-right: 0;
  }

  .history-dialog {
    width: min(90vw, 440px);
    max-height: 80vh;
    overflow-y: auto;
    box-sizing: border-box;
  }

  .history-subtitle {
    font-size: 0.8rem;
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
    font-size: 1.1rem;
    font-weight: 600;
  }

  .history-stat-label {
    font-size: 0.7rem;
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
    font-size: 0.75rem;
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
    font-size: 0.8rem;
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
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
  }

  .schedule-row:last-child {
    border-bottom: none;
  }

  .schedule-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .schedule-info-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .schedule-row ha-switch {
    /* Material 2 (mwc-switch based) size vars. */
    --mdc-switch-track-height: 12px;
    --mdc-switch-track-width: 20px;
    --mdc-switch-state-layer-size: 16px;
    /* Material 3 (md-switch based) size vars -- newer HA versions render
       ha-switch through this component instead, which ignores the mdc-*
       vars above entirely. */
    --md-switch-track-width: 28px;
    --md-switch-track-height: 16px;
    --md-switch-state-layer-size: 20px;
    --md-switch-selected-handle-width: 12px;
    --md-switch-selected-handle-height: 12px;
    --md-switch-unselected-handle-width: 10px;
    --md-switch-unselected-handle-height: 10px;
    --md-switch-selected-icon-size: 0px;
    --md-switch-unselected-icon-size: 0px;
    flex-shrink: 0;
    /* ha-switch keeps an invisible touch-target inset around the visible
       track regardless of the size vars above. Trim it on the LEFT only (no
       sibling there, it is the row's first column) so the switch doesn't
       waste space; keep the right side clear so it doesn't crowd the info
       column beyond the row's own column gap. */
    margin: 0 6px 0 -10px;
  }

  .schedule-time {
    font-size: 1rem;
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
    font-size: 0.8rem;
    width: 15px;
    text-align: center;
    color: var(--disabled-text-color, rgba(255, 255, 255, 0.3));
  }

  .day-initial.active {
    color: var(--primary-text-color);
    font-weight: 600;
  }

  .warning-icon {
    --mdc-icon-size: 18px;
    color: var(--warning-color, #ff9800);
    flex-shrink: 0;
  }

  .schedule-duration {
    font-size: 0.9rem;
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

  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 16px 16px;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
    margin-top: 8px;
  }

  .settings-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .settings-actions button {
    padding: 8px 16px;
    font-size: 0.9rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .schedule-actions {
    display: flex;
    align-items: center;
  }

  .schedule-actions ha-icon-button {
    --mdc-icon-button-size: 20px;
    --mdc-icon-size: 13px;
    margin: 0 -6px;
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
    margin-top: 12px;
  }

  .action-circle {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .action-circle:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .action-circle ha-icon {
    --mdc-icon-size: 20px;
  }

  .config-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    color: var(--error-color, #db4437);
    font-size: 0.9rem;
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
    font-size: 1rem;
    font-weight: 500;
    margin-bottom: 12px;
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field label {
    font-size: 0.8rem;
    color: var(--secondary-text-color);
  }

  .field input[type="time"],
  .field input[type="number"] {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 1rem;
    color: var(--primary-text-color);
    background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    color-scheme: dark;
  }

  .day-picker {
    display: grid;
    grid-template-columns: repeat(7, auto);
    gap: 4px;
    justify-content: start;
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
    font-size: 0.7rem;
    color: var(--secondary-text-color);
    margin-bottom: 2px;
  }

  .duration-segment-input {
    width: 30px;
    text-align: center;
    font-size: 1.1rem;
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
    font-size: 1.1rem;
    font-weight: 500;
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
    font-size: 1rem;
    color: var(--primary-text-color);
    background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    color-scheme: dark;
  }

  .duration-part span {
    font-size: 0.8rem;
    color: var(--secondary-text-color);
    flex-shrink: 0;
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

  .day-option input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--primary-color, #03a9f4);
    cursor: pointer;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .dialog-actions button {
    padding: 8px 16px;
    font-size: 0.9rem;
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
  .compact .next-run,
  .compact .last-run {
    display: none;
  }
`,$t=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"],xt=/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;function wt(t){const e=xt.exec(t);if(!e)return null;const i=Number(e[1]),s=Number(e[2]),r=e[3]?Number(e[3]):0;return i>23||s>59||r>59?null:{hour:i,minute:s,second:r}}function Et(t){const e=wt(t);if(!e)return t;const i=t.slice(0,t.indexOf(":")),s=String(e.minute).padStart(2,"0");return e.second>0?`${i}:${s}:${String(e.second).padStart(2,"0")}`:`${i}:${s}`}function St(){return[...$t]}function At(t){const e=Math.max(0,Math.round(Number.isFinite(t)?t:0));if(e<60)return`${e} s`;const i=Math.round(e/60),s=Math.floor(i/60),r=i%60,n=[];return s>0&&n.push(`${s} h`),r>0&&n.push(`${r} min`),n.join(" ")}function Ct(t,e){const i=function(t,e){const i=Number.isFinite(t)?t:0;return i<=0?null:i/3600*(Number.isFinite(e)?Math.max(0,e):0)}(t,e);return null===i?null:1e3*i}function Mt(t,e,i){const s=Ct(t,e);if(null===s)return null;return s*(Number.isFinite(i)&&i>0?i:1)}function Pt(t){return Number.isFinite(t)?t>=1e3?(e=t/1e3,Number.isFinite(e)?Math.round(100*e)/100+" L":"0 L"):Math.round(100*t)/100+" ml":"0 ml";var e}function kt(t){const e=wt(t);return e?3600*e.hour+60*e.minute+e.second:-1}function Nt(t,e){if(!Number.isFinite(t))return"?";const i=Math.round(100*t)/100;return e?`${i} ${e}`:`${i}`}function Dt(t){const e=wt(t);if(!e)return t;return`${String(e.hour).padStart(2,"0")}:${String(e.minute).padStart(2,"0")}:${String(e.second).padStart(2,"0")}`}function Tt(t,e){return new Intl.DateTimeFormat("en-CA",{timeZone:e,year:"numeric",month:"2-digit",day:"2-digit"}).format(t)}function zt(t,e,i){const s=new Date(t);if(Number.isNaN(s.getTime()))return"";const r=new Date(e);if(Tt(s,i)===Tt(r,i))return"Hoje";const n=new Date(r.getTime()-864e5);return Tt(s,i)===Tt(n,i)?"Ontem":new Intl.DateTimeFormat("pt-BR",{timeZone:i,day:"2-digit",month:"2-digit"}).format(s)}function Rt(t){if(!t||"object"!=typeof t)throw new Error("Configuração inválida para o card de irrigação.");const e=t.entity;if("string"!=typeof e||0===e.length||!e.startsWith("sensor."))throw new Error('O card exige um sensor da integração: "sensor.<zona>_next_run".')}class Ht extends at{constructor(){super(...arguments),this._config={type:"custom:irrigation-schedule-card"},this._now=0,this._dialogOpen=!1,this._historyOpen=!1,this._settingsOpen=!1,this._settingsDefaultDuration="",this._settingsFlow="",this._settingsPots="",this._settingsReservoir="",this._settingsPhEntity="",this._settingsPhEntityTouched=!1,this._settingsPhMin="",this._settingsPhMax="",this._settingsEcEntity="",this._settingsEcEntityTouched=!1,this._settingsPhEntity2="",this._settingsPhEntity2Touched=!1,this._settingsPhMin2="",this._settingsPhMax2="",this._settingsEcEntity2="",this._settingsEcEntity2Touched=!1,this._settingsError=null,this._editingId=null,this._formTime="06:00",this._formDays=[],this._formDurationHour=0,this._formDurationMin=15,this._formDurationSec=0,this._formError=null,this._tickerId=null}static{this.styles=bt}static getConfigElement(){return document.createElement("irrigation-schedule-card-editor")}static getStubConfig(){return{show_next_run:gt,show_water_now:mt,compact:_t}}setConfig(t){Rt(t),this._config={...t}}getCardSize(){return this._config.compact?2:4}disconnectedCallback(){super.disconnectedCallback(),this._stopTicker()}updated(t){super.updated(t),this._isWatering()?null===this._tickerId&&(this._tickerId=window.setInterval(()=>{this._now=Date.now()},1e3)):null!==this._tickerId&&this._stopTicker()}render(){if(!this.hass)return this._renderConfigError("O card ainda não recebeu o objeto hass do Home Assistant.");try{if(!this._config.entity)return this._renderConfigError("Configure o card com o sensor da zona: sensor.<zona>_next_run.");if(!this._config.entity.startsWith("sensor."))return this._renderConfigError(`"${this._config.entity}" não é um sensor da integração irrigation_scheduler.`);const t=this._sensorEntity;return t?"switch_entity_id"in t.attributes&&"binary_sensor_entity_id"in t.attributes?this._renderCard(t):this._renderConfigError(`"${this._config.entity}" não é um sensor da integração irrigation_scheduler.`):this._renderConfigError(`Entidade "${this._config.entity}" não encontrada.`)}catch(t){return console.error("[irrigation-schedule-card] render failed",t),this._renderConfigError(`Falha ao renderizar o card: ${t instanceof Error?t.message:String(t)}`)}}_renderConfigError(t){return B`
      <ha-card>
        <div class="config-error">
          <ha-icon icon="mdi:alert-outline"></ha-icon>
          <div>${t}</div>
        </div>
      </ha-card>
    `}_renderCard(t){const e=this._config.compact??_t,i=this._config.show_next_run??gt,s=this._config.show_water_now??mt,r=St(),n=function(t){return[...t].sort((t,e)=>kt(t.time)-kt(e.time))}(function(t){if(!Array.isArray(t))return[];const e=[];for(const i of t){if(null===i||"object"!=typeof i)continue;const t=i,s="string"==typeof t.time&&null!==wt(t.time)?Dt(t.time):"",r=Array.isArray(t.days)?t.days.filter(t=>"number"==typeof t&&Number.isInteger(t)&&t>=0&&t<=6):[],n="number"==typeof t.duration&&Number.isFinite(t.duration)&&t.duration>0?t.duration:0;!s||0===r.length||n<=0||e.push({id:"string"==typeof t.id?t.id:"",time:s,days:[...new Set(r)].sort((t,e)=>t-e),duration:n,enabled:"boolean"!=typeof t.enabled||t.enabled})}return e}(t.attributes.schedules)),o=this._numberAttr(t,"default_duration")??600,a=this._numberAttr(t,"flow_rate_lph")??0,l=this._numberAttr(t,"number_of_pots")??0,c=this._numberAttr(t,"reservoir_volume_l")??0,d=this._numberAttr(t,"reservoir_remaining_l")??c,h=this._stringAttr(t,"ph_entity_id")??"",u=this._numberAttr(t,"ph_min")??0,p=this._numberAttr(t,"ph_max")??14,g=this._phStatusClass(h,u,p),m=this._stringAttr(t,"ec_entity_id")??"",_=this._stringAttr(t,"ph_entity_id_2")??"",f=this._numberAttr(t,"ph_min_2")??0,v=this._numberAttr(t,"ph_max_2")??14,y=this._phStatusClass(_,f,v),b=this._stringAttr(t,"ec_entity_id_2")??"",$=this._scheduleWarnings(t),x=this._switchEid?this.hass?.states[this._switchEid]:void 0,w=this._binarySensorEid?this.hass?.states[this._binarySensorEid]:void 0,E="on"===w?.state,S="on"===x?.state,A=E?"Regando":S?"Agendada":"Desabilitada",C=E?"status-watering":S?"status-scheduled":"status-disabled",M=this._stringAttr(w,"finishes_at"),P=this._stringAttr(w,"started_at"),k=this._now>0?new Date(this._now).toISOString():(new Date).toISOString(),N=M?function(t,e){const i=Date.parse(t),s=Date.parse(e);return Number.isFinite(i)&&Number.isFinite(s)?Math.max(0,Math.floor((i-s)/1e3)):0}(M,k):0,D=P&&M?function(t,e,i){const s=Date.parse(t),r=Date.parse(e),n=Date.parse(i);if(!Number.isFinite(s)||!Number.isFinite(r)||!Number.isFinite(n))return 0;const o=s-r;return o<=0?100:Math.min(100,Math.max(0,(n-r)/o*100))}(M,P,k):0,T=this._lastRunAttr(w),z=this._historyAttr(w),R=c>0?B`<span class="sensor-badge volume-badge"
            >${function(t,e){const i=t=>Math.round(10*t)/10;return`${i(Number.isFinite(t)?Math.max(0,t):0)}/${i(Number.isFinite(e)?Math.max(0,e):0)} L`}(d,c)}</span
          >`:"",H=function(t,e,i){let s=0;for(const r of t){if(!r.enabled)continue;const t=Mt(e,r.duration,i);null!==t&&(s+=t*r.days.length)}return s/1e3/7}(n,a,l),O=function(t,e){if(!Number.isFinite(e)||e<=0)return null;const i=Number.isFinite(t)?Math.max(0,t):0;if(i<=0)return"Vazio";const s=i/e;if(s<1)return`~${Math.max(1,Math.round(24*s))} h`;return s<=60?`~${Math.max(1,Math.round(s))} dias`:`~${Math.max(1,Math.round(s/30))} meses`}(d,H),F=c>0&&O?B`<span class="reservoir-estimate">${O}</span>`:"",I=c>0?B`
            <button
              class="refill-button"
              title="Reabastecer reservatório"
              @click=${this._refillReservoir}
            >
              <ha-icon icon="mdi:water-plus"></ha-icon>
            </button>
          `:"",j=Boolean(h||m||c>0),U=Boolean(_||b);return B`
      <ha-card class=${e?"compact":""}>
        <div class="header">
          <div class="header-top">
            <div class="header-title" title=${this._config.entity??""}>
              ${this._zoneName(t)}
            </div>
            <div class="header-right">
              <span class="status ${C}">${A}</span>
              ${x?B`
                    <ha-switch
                      .checked=${S}
                      title=${S?"Agendamento ativo":"Agendamento desativado"}
                      @change=${t=>this._toggleMaster(x,t)}
                    ></ha-switch>
                  `:B`<ha-switch disabled></ha-switch>`}
              <ha-icon-button
                title="Configurar vazão e vasos"
                @click=${this._openSettings}
              >
                <ha-icon icon="mdi:cog"></ha-icon>
              </ha-icon-button>
            </div>
          </div>
          ${j||U?B`
                <div class="header-badges">
                  ${j?this._renderReservoirRow(U?"R1":"",1,h,g,m,R,F,I):""}
                  ${U?this._renderReservoirRow(j?"R2":"",2,_,y,b,R,F,I):""}
                </div>
              `:""}
        </div>

        ${this._renderSettings(o,a,l,c,h,u,p,m,_,f,v,b)}

        ${E&&M?B`
              <div class="watering-bar">
                <div class="watering-info">
                  <div class="watering-left">
                    <ha-icon icon="mdi:sprinkler-variant"></ha-icon>
                    <span>Regando</span>
                  </div>
                  <div class="watering-remaining">
                    ${function(t){const e=Math.max(0,Math.floor(Number.isFinite(t)?t:0)),i=Math.floor(e/3600),s=Math.floor(e%3600/60),r=e%60,n=String(s).padStart(2,"0"),o=String(r).padStart(2,"0");return i>0?`${i}:${n}:${o}`:`${n}:${o}`}(N)}
                  </div>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    style="width: ${D}%"
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

        ${!E&&i?B`
              <div class="next-run">
                <ha-icon icon="mdi:clock-start"></ha-icon>
                <span>Próximo: ${this._nextRunText(t.state)}</span>
              </div>
            `:""}

        ${T?B`
              <div class="last-run" @click=${this._openHistory}>
                <ha-icon icon="mdi:history"></ha-icon>
                <span>Última rega: ${this._lastRunText(T,k)}</span>
                <span class="schedule-row-spacer"></span>
                <ha-icon class="last-run-chevron" icon="mdi:chevron-right"></ha-icon>
              </div>
            `:""}

        <div class="section-divider"></div>

        <div class="card-body">
          <div class="schedules">
            ${0===n.length?B`<div class="empty">Nenhum horário configurado.</div>`:n.map(t=>this._renderScheduleRow(t,a,l,$[t.id]))}
          </div>

          <div class="section-divider"></div>

          <div class="actions">
            <button class="action-circle" title="Adicionar horário" @click=${this._openAdd}>
              <ha-icon icon="mdi:plus"></ha-icon>
            </button>
            ${s?B`
                  <button
                    class="action-circle"
                    title="Regar agora"
                    ?disabled=${E}
                    @click=${this._waterNow}
                  >
                    <ha-icon icon="mdi:play"></ha-icon>
                  </button>
                `:""}
          </div>
        </div>
      </ha-card>

      ${this._renderDialog(r,a)}
      ${this._renderHistoryDialog(z,this._zoneName(t),k)}
    `}_renderReservoirRow(t,e,i,s,r,n,o,a){const l=i?B`
          <button
            class="sensor-badge ph-badge ${s}"
            title="Ver histórico do pH (reservatório ${e})"
            @click=${()=>this._openMoreInfo(i)}
          >
            ${this._sensorBadgeText(i,"pH ?",t=>`${Nt(t)} PH`)}
          </button>
        `:B`<span></span>`,c=r?B`
          <button
            class="sensor-badge ec-badge"
            title="Ver histórico da EC (reservatório ${e})"
            @click=${()=>this._openMoreInfo(r)}
          >
            ${this._sensorBadgeText(r,"EC ?",(t,e)=>`EC ${Nt(t,e)}`)}
          </button>
        `:B`<span></span>`;return[t?B`<span class="reservoir-label">${t}</span>`:B`<span></span>`,l,c,n,o,a]}_renderScheduleRow(t,e,i,s){const r=Ct(e,t.duration),n=Mt(e,t.duration,i);return B`
      <div class="schedule-row">
        <ha-switch
          ?checked=${t.enabled}
          @change=${e=>this._toggleScheduleEnabled(t,e)}
        ></ha-switch>
        <div class="schedule-info">
          <div class="schedule-info-top">
            <div class="schedule-time">${Et(t.time)}</div>
            <div class="schedule-days">
              ${St().map(t=>t.charAt(0)).map((e,i)=>B`
                  <span class="day-initial ${t.days.includes(i)?"active":""}">
                    ${e}
                  </span>
                `)}
            </div>
            ${s?B`
                  <ha-icon
                    class="warning-icon"
                    icon="mdi:alert"
                    title=${`Última rega pulada: ${s}`}
                  ></ha-icon>
                `:""}
          </div>
          <div class="schedule-duration">
            ${At(t.duration)}
            ${null!==n?B`<span class="schedule-volume">· ≈ ${Pt(n)}</span>`:""}
            ${null!==n&&null!==r?B`<span class="schedule-perpot">· ${Pt(r)}/vaso</span>`:""}
          </div>
        </div>
        <div class="schedule-actions">
          <ha-icon-button title="Editar" @click=${()=>this._openEdit(t)}>
            <ha-icon icon="mdi:pencil"></ha-icon>
          </ha-icon-button>
          <ha-icon-button title="Excluir" @click=${()=>this._deleteSchedule(t)}>
            <ha-icon icon="mdi:delete"></ha-icon>
          </ha-icon-button>
        </div>
      </div>
    `}_renderSettings(t,e,i,s,r,n,o,a,l,c,d,h){if(!this._settingsOpen)return B``;const u=Math.max(1,Math.round(t/60));return B`
      <div class="settings-panel">
        <div class="field">
          <label>Duração padrão da rega (min)</label>
          <input
            type="number"
            min="1"
            .value=${this._settingsDefaultDuration||String(u)}
            @change=${this._onSettingsDefaultDurationChange}
          />
        </div>
        <div class="field">
          <label>Vazão por vaso (L/h)</label>
          <input
            type="number"
            min="0"
            .value=${this._settingsFlow||String(e)}
            @change=${this._onSettingsFlowChange}
          />
        </div>
        <div class="field">
          <label>Número de vasos</label>
          <input
            type="number"
            min="0"
            .value=${this._settingsPots||String(i)}
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
        <div class="field">
          <label>Sensor de pH R1 (opcional)</label>
          <input
            type="text"
            list="ph-sensor-options"
            placeholder="sensor.reservatorio_ph"
            .value=${this._settingsPhEntityTouched?this._settingsPhEntity:r}
            @change=${this._onSettingsPhEntityChange}
          />
          <datalist id="ph-sensor-options">
            ${this._sensorEntityIds().map(t=>B`<option value=${t}></option>`)}
          </datalist>
        </div>
        <div class="field">
          <label>Só regar (agendado) com pH R1 entre</label>
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
                .value=${this._settingsPhMax||String(o)}
                @change=${this._onSettingsPhMaxChange}
              />
            </div>
          </div>
        </div>
        <div class="field">
          <label>Sensor de EC R1 (opcional, só exibição)</label>
          <input
            type="text"
            list="ec-sensor-options"
            placeholder="sensor.reservatorio_ec"
            .value=${this._settingsEcEntityTouched?this._settingsEcEntity:a}
            @change=${this._onSettingsEcEntityChange}
          />
          <datalist id="ec-sensor-options">
            ${this._sensorEntityIds().map(t=>B`<option value=${t}></option>`)}
          </datalist>
        </div>
        <div class="field">
          <label>Sensor de pH R2 (opcional, segundo reservatório)</label>
          <input
            type="text"
            list="ph-sensor-options-2"
            placeholder="sensor.reservatorio2_ph"
            .value=${this._settingsPhEntity2Touched?this._settingsPhEntity2:l}
            @change=${this._onSettingsPhEntity2Change}
          />
          <datalist id="ph-sensor-options-2">
            ${this._sensorEntityIds().map(t=>B`<option value=${t}></option>`)}
          </datalist>
        </div>
        <div class="field">
          <label>Só regar (agendado) com pH R2 entre</label>
          <div class="duration-row">
            <div class="duration-part">
              <input
                type="number"
                min="0"
                max="14"
                step="0.1"
                .value=${this._settingsPhMin2||String(c)}
                @change=${this._onSettingsPhMin2Change}
              />
            </div>
            <div class="duration-part">
              <input
                type="number"
                min="0"
                max="14"
                step="0.1"
                .value=${this._settingsPhMax2||String(d)}
                @change=${this._onSettingsPhMax2Change}
              />
            </div>
          </div>
        </div>
        <div class="field">
          <label>Sensor de EC R2 (opcional, só exibição)</label>
          <input
            type="text"
            list="ec-sensor-options-2"
            placeholder="sensor.reservatorio2_ec"
            .value=${this._settingsEcEntity2Touched?this._settingsEcEntity2:h}
            @change=${this._onSettingsEcEntity2Change}
          />
          <datalist id="ec-sensor-options-2">
            ${this._sensorEntityIds().map(t=>B`<option value=${t}></option>`)}
          </datalist>
        </div>
        ${this._settingsError?B`<div class="form-error">${this._settingsError}</div>`:""}
        <div class="settings-actions">
          <button class="dialog-cancel" @click=${this._closeSettings}>
            Fechar
          </button>
          <button class="dialog-save" @click=${this._saveSettings}>Salvar</button>
        </div>
      </div>
    `}_openSettings(){this._settingsOpen?this._closeSettings():this._settingsOpen=!0}_openHistory(){this._historyOpen=!0}_closeHistory(){this._historyOpen=!1}_closeSettings(){this._settingsOpen=!1,this._settingsDefaultDuration="",this._settingsFlow="",this._settingsPots="",this._settingsReservoir="",this._settingsPhEntity="",this._settingsPhEntityTouched=!1,this._settingsPhMin="",this._settingsPhMax="",this._settingsEcEntity="",this._settingsEcEntityTouched=!1,this._settingsPhEntity2="",this._settingsPhEntity2Touched=!1,this._settingsPhMin2="",this._settingsPhMax2="",this._settingsEcEntity2="",this._settingsEcEntity2Touched=!1,this._settingsError=null}_onSettingsDefaultDurationChange(t){this._settingsDefaultDuration=t.target.value}_onSettingsFlowChange(t){this._settingsFlow=t.target.value}_onSettingsPotsChange(t){this._settingsPots=t.target.value}_onSettingsReservoirChange(t){this._settingsReservoir=t.target.value}_onSettingsPhEntityChange(t){this._settingsPhEntity=t.target.value.trim(),this._settingsPhEntityTouched=!0,this._settingsError=null}_onSettingsPhMinChange(t){this._settingsPhMin=t.target.value,this._settingsError=null}_onSettingsPhMaxChange(t){this._settingsPhMax=t.target.value,this._settingsError=null}_onSettingsEcEntityChange(t){this._settingsEcEntity=t.target.value.trim(),this._settingsEcEntityTouched=!0,this._settingsError=null}_onSettingsPhEntity2Change(t){this._settingsPhEntity2=t.target.value.trim(),this._settingsPhEntity2Touched=!0,this._settingsError=null}_onSettingsPhMin2Change(t){this._settingsPhMin2=t.target.value,this._settingsError=null}_onSettingsPhMax2Change(t){this._settingsPhMax2=t.target.value,this._settingsError=null}_onSettingsEcEntity2Change(t){this._settingsEcEntity2=t.target.value.trim(),this._settingsEcEntity2Touched=!0,this._settingsError=null}_saveSettings(){const t=Number.parseInt(this._settingsDefaultDuration,10),e=Number.parseInt(this._settingsFlow,10),i=Number.parseInt(this._settingsPots,10),s=Number.parseInt(this._settingsReservoir,10),r={};Number.isFinite(t)&&t>=1&&(r.default_duration=60*t),Number.isFinite(e)&&e>=0&&(r.flow_rate_lph=e),Number.isFinite(i)&&i>=0&&(r.number_of_pots=i),Number.isFinite(s)&&s>=0&&(r.reservoir_volume_l=s);const n=Number.parseFloat(this._settingsPhMin),o=Number.parseFloat(this._settingsPhMax),a=Number.isFinite(n)&&n>=0&&n<=14,l=Number.isFinite(o)&&o>=0&&o<=14;if(a&&l&&n>o)return void(this._settingsError="O pH mínimo não pode ser maior que o pH máximo.");a&&(r.ph_min=n),l&&(r.ph_max=o),this._settingsPhEntityTouched&&(r.ph_entity_id=this._settingsPhEntity),this._settingsEcEntityTouched&&(r.ec_entity_id=this._settingsEcEntity);const c=Number.parseFloat(this._settingsPhMin2),d=Number.parseFloat(this._settingsPhMax2),h=Number.isFinite(c)&&c>=0&&c<=14,u=Number.isFinite(d)&&d>=0&&d<=14;h&&u&&c>d?this._settingsError="O pH mínimo R2 não pode ser maior que o pH máximo R2.":(h&&(r.ph_min_2=c),u&&(r.ph_max_2=d),this._settingsPhEntity2Touched&&(r.ph_entity_id_2=this._settingsPhEntity2),this._settingsEcEntity2Touched&&(r.ec_entity_id_2=this._settingsEcEntity2),0!==Object.keys(r).length?this._callService("set_zone_options",r).then(()=>this._closeSettings(),t=>{this._settingsError=this._describeServiceError(t)}):this._closeSettings())}_lastRunText(t,e){const i=this.hass?.config?.time_zone,s=new Date(t.started_at),r=zt(t.started_at,e,i),n=Number.isNaN(s.getTime())?"":new Intl.DateTimeFormat("pt-BR",{timeZone:i,hour:"2-digit",minute:"2-digit"}).format(s),o="manual"===t.source?"manual":"agendada",a=Ct(t.flow_rate_lph,t.duration),l=[[r,n].filter(Boolean).join(" "),o,At(t.duration)];return null!==a&&l.push(`${Pt(a)}/vaso`),l.filter(Boolean).join(" · ")}_renderHistoryDialog(t,e,i){if(!this._historyOpen)return B``;const s=function(t,e,i){const s=new Map;for(const r of t){const t=new Date(r.started_at);if(Number.isNaN(t.getTime()))continue;const n=Tt(t,i);let o=s.get(n);o||(o={label:zt(r.started_at,e,i),entries:[],totalMl:0},s.set(n,o)),o.entries.push(r);const a=Mt(r.flow_rate_lph,r.duration,r.number_of_pots);null!==a&&(o.totalMl+=a)}return Array.from(s.values())}(t,i,this.hass?.config?.time_zone),r=s.reduce((t,e)=>t+e.totalMl,0);return B`
      <div class="overlay" @click=${this._closeHistory}>
        <div
          class="dialog history-dialog"
          role="dialog"
          aria-modal="true"
          @click=${t=>t.stopPropagation()}
        >
          <div class="dialog-header">
            Histórico de regas
            <div class="history-subtitle">${e} · últimos 30 dias</div>
          </div>
          <div class="history-stats">
            <div class="history-stat">
              <span class="history-stat-value">${t.length}</span>
              <span class="history-stat-label">${1===t.length?"rega":"regas"}</span>
            </div>
            <div class="history-stat">
              <span class="history-stat-value">${Pt(r)}</span>
              <span class="history-stat-label">total no período</span>
            </div>
          </div>
          <div class="history-body">
            ${0===s.length?B`<div class="empty">Nenhuma rega registrada ainda.</div>`:s.map(t=>this._renderHistoryDayGroup(t))}
          </div>
          <div class="dialog-actions">
            <button class="dialog-cancel" @click=${this._closeHistory}>Fechar</button>
          </div>
        </div>
      </div>
    `}_renderHistoryDayGroup(t){return B`
      <div class="history-day">
        <div class="history-day-header">
          <span>${t.label}</span>
          <span class="history-day-total">
            ${t.entries.length} ${1===t.entries.length?"rega":"regas"}
            ${t.totalMl>0?B`· ${Pt(t.totalMl)}`:""}
          </span>
        </div>
        ${t.entries.map(t=>this._renderHistoryEntry(t))}
      </div>
    `}_renderHistoryEntry(t){const e=new Date(t.started_at),i=Number.isNaN(e.getTime())?"":new Intl.DateTimeFormat("pt-BR",{timeZone:this.hass?.config?.time_zone,hour:"2-digit",minute:"2-digit"}).format(e),s=Ct(t.flow_rate_lph,t.duration),r="manual"===t.source;return B`
      <div class="history-entry">
        <ha-icon icon=${r?"mdi:hand-back-right":"mdi:calendar-clock"}></ha-icon>
        <span>${i} · ${r?"manual":"agendada"}</span>
        <span class="schedule-row-spacer"></span>
        <span class="history-entry-detail">
          ${At(t.duration)}
          ${null!==s?B` · ${Pt(s)}/vaso`:""}
          ${null!==t.ph_value?B` · ${Nt(t.ph_value)} PH`:""}
          ${null!==t.ec_value?B` · EC ${Nt(t.ec_value,t.ec_unit??void 0)}`:""}
          ${"number"==typeof t.ph_value_2?B` · ${Nt(t.ph_value_2)} PH R2`:""}
          ${"number"==typeof t.ec_value_2?B` · EC ${Nt(t.ec_value_2,t.ec_unit_2??void 0)} R2`:""}
        </span>
      </div>
    `}_renderDialog(t,e){if(!this._dialogOpen)return B``;const i=Ct(e,3600*this._formDurationHour+60*this._formDurationMin+this._formDurationSec);return B`
      <div class="overlay" @click=${this._closeDialog}>
        <div
          class="dialog"
          role="dialog"
          aria-modal="true"
          @click=${t=>t.stopPropagation()}
        >
          <div class="dialog-header">
            ${this._editingId?"Editar horário":"Adicionar horário"}
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
              <label>Dias da semana</label>
              <div class="day-picker">
                ${t.map((t,e)=>B`
                    <label class="day-option">
                      <input
                        type="checkbox"
                        ?checked=${this._formDays.includes(e)}
                        @change=${t=>this._toggleDay(e,t)}
                      />
                      <span>${t}</span>
                    </label>
                  `)}
              </div>
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
            ${null!==i?B`
                  <div class="field">
                    <label>Volume por vaso (ml)</label>
                    <input
                      type="number"
                      min="0"
                      .value=${String(Math.round(i))}
                      @change=${this._onVolumeChange}
                    />
                  </div>
                `:""}
            ${this._formError?B` <div class="form-error">${this._formError}</div> `:""}
          </div>
          <div class="dialog-actions">
            <button class="dialog-cancel" @click=${this._closeDialog}>
              Cancelar
            </button>
            <button class="dialog-save" @click=${this._saveDialog}>Salvar</button>
          </div>
        </div>
      </div>
    `}get _sensorEntity(){const t=this._config.entity;return t?this.hass?.states[t]:void 0}get _switchEid(){return this._stringAttr(this._sensorEntity,"switch_entity_id")}get _binarySensorEid(){return this._stringAttr(this._sensorEntity,"binary_sensor_entity_id")}_isWatering(){const t=this._binarySensorEid;return!!t&&"on"===this.hass?.states[t]?.state}_stringAttr(t,e){const i=t?.attributes[e];return"string"==typeof i&&i?i:void 0}_numberAttr(t,e){const i=t?.attributes[e];return"number"==typeof i&&Number.isFinite(i)?i:void 0}_scheduleWarnings(t){const e=t?.attributes.schedule_warnings;if(!e||"object"!=typeof e)return{};const i={};for(const[t,s]of Object.entries(e))"string"==typeof s&&(i[t]=s);return i}_isHistoryRun(t){if(!t||"object"!=typeof t)return!1;const e=t;return"string"==typeof e.started_at&&"number"==typeof e.duration}_lastRunAttr(t){const e=t?.attributes.last_run;return this._isHistoryRun(e)?e:null}_historyAttr(t){const e=t?.attributes.history;return Array.isArray(e)?e.filter(t=>this._isHistoryRun(t)):[]}_sensorEntityIds(){return this.hass?Object.keys(this.hass.states).filter(t=>t.startsWith("sensor.")).sort():[]}_phStatusClass(t,e,i){if(!t)return"";const s=this.hass?.states[t],r=s?Number.parseFloat(s.state):Number.NaN;return Number.isFinite(r)?r>=e&&r<=i?"in-range":"out-of-range":""}_sensorBadgeText(t,e,i){const s=this.hass?.states[t],r=s?Number.parseFloat(s.state):Number.NaN;if(!Number.isFinite(r))return e;return i(r,"string"==typeof s?.attributes.unit_of_measurement?s.attributes.unit_of_measurement:void 0)}_openMoreInfo(t){this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t},bubbles:!0,composed:!0}))}_zoneName(t){const e=this._config.name;if(e&&e.trim())return e;const i=this._stringAttr(t,"friendly_name");if(!i)return this._config.entity??"";const s=[" próxima execução"," next run"," próximo horário"," proximo horario"];for(const t of s)if(i.toLowerCase().endsWith(t))return i.slice(0,i.length-t.length).trim();return i}_nextRunText(t){const e=new Date(t);return!t||Number.isNaN(e.getTime())?"Nenhum horário agendado":new Intl.DateTimeFormat("pt-BR",{timeZone:this.hass?.config?.time_zone,weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(e)}_stopTicker(){null!==this._tickerId&&(window.clearInterval(this._tickerId),this._tickerId=null),this._now=0}_callService(t,e={}){if(!this.hass||!this._config.entity)return Promise.resolve();const i=this._config.entity;return this.hass.callService(pt,t,e,{entity_id:i}).catch(e=>{throw console.error(`[irrigation-schedule-card] ${pt}.${t} failed`,e),e})}_describeServiceError(t){if(t&&"object"==typeof t&&"message"in t){const e=t.message;if("string"==typeof e&&e.trim())return e}return"Não foi possível salvar: o backend rejeitou os dados enviados."}_waterNow(){this._callService("water_now")}_toggleMaster(t,e){const i=e.target.checked;this.hass&&this.hass.callService("switch",i?"turn_on":"turn_off",{},{entity_id:t.entity_id}).catch(t=>{console.error("[irrigation-schedule-card] switch toggle failed",t)})}_stopWatering(){this._callService("stop")}_refillReservoir(){window.confirm("Marcar o reservatório como reabastecido (volume cheio)?")&&this._callService("refill_reservoir")}_toggleScheduleEnabled(t,e){const i=e.target.checked;this._callService("update_schedule",{id:t.id,enabled:i})}_deleteSchedule(t){window.confirm(`Excluir o horário das ${Et(t.time)}?`)&&this._callService("remove_schedule",{id:t.id})}_openAdd(){this._editingId=null,this._formTime="00:00",this._formDays=[],this._formDurationHour=0,this._formDurationMin=0,this._formDurationSec=0,this._formError=null,this._dialogOpen=!0}_openEdit(t){this._editingId=t.id,this._formTime=Et(t.time),this._formDays=[...t.days];const e=Math.max(1,Math.round(t.duration));this._formDurationHour=Math.floor(e/3600),this._formDurationMin=Math.floor(e%3600/60),this._formDurationSec=e%60,this._formError=null,this._dialogOpen=!0}_closeDialog(){this._dialogOpen=!1,this._editingId=null,this._formError=null}_saveDialog(){const t=Dt(this._formTime),e=[...this._formDays].sort((t,e)=>t-e),i=3600*this._formDurationHour+60*this._formDurationMin+this._formDurationSec;if(kt(t)<0||0===e.length||i<=0)return void(this._formError="Informe um horário, ao menos um dia e uma duração válida.");(this._editingId?this._callService("update_schedule",{id:this._editingId,time:t,days:e,duration:i}):this._callService("add_schedule",{time:t,days:e,duration:i,enabled:!0})).then(()=>this._closeDialog(),t=>{this._formError=this._describeServiceError(t)})}_onTimeChanged(t){const e=t.target.value;"string"==typeof e&&(this._formTime=e,this._formError=null)}_toggleDay(t,e){if(t<0||t>6)return;const i=e.target.checked;this._formDays=i?[...this._formDays,t]:this._formDays.filter(e=>e!==t),this._formError=null}_onDurationHourChange(t){const e=t.target.value,i=Number.parseInt(e,10);this._formDurationHour=Number.isFinite(i)&&i>=0?Math.min(99,i):0,this._formError=null}_onDurationMinChange(t){const e=t.target.value,i=Number.parseInt(e,10);this._formDurationMin=Number.isFinite(i)&&i>=0?Math.min(59,i):0,this._formError=null}_onDurationSecChange(t){const e=t.target.value,i=Number.parseInt(e,10),s=Number.isFinite(i)&&i>=0?Math.min(59,i):0;this._formDurationSec=s,this._formError=null}_onVolumeChange(t){const e=t.target.value,i=Number.parseInt(e,10),s=function(t,e){const i=Number.isFinite(t)?t:0;if(i<=0)return null;const s=(Number.isFinite(e)?Math.max(0,e):0)/1e3;return Math.round(s/i*3600)}(this._numberAttr(this._sensorEntity,"flow_rate_lph")??0,Number.isFinite(i)?i:0);null!==s&&(this._formDurationHour=Math.floor(s/3600),this._formDurationMin=Math.floor(s%3600/60),this._formDurationSec=s%60,this._formError=null)}}return e([ht({attribute:!1})],Ht.prototype,"hass",void 0),e([ut()],Ht.prototype,"_config",void 0),e([ut()],Ht.prototype,"_now",void 0),e([ut()],Ht.prototype,"_dialogOpen",void 0),e([ut()],Ht.prototype,"_historyOpen",void 0),e([ut()],Ht.prototype,"_settingsOpen",void 0),e([ut()],Ht.prototype,"_settingsDefaultDuration",void 0),e([ut()],Ht.prototype,"_settingsFlow",void 0),e([ut()],Ht.prototype,"_settingsPots",void 0),e([ut()],Ht.prototype,"_settingsReservoir",void 0),e([ut()],Ht.prototype,"_settingsPhEntity",void 0),e([ut()],Ht.prototype,"_settingsPhMin",void 0),e([ut()],Ht.prototype,"_settingsPhMax",void 0),e([ut()],Ht.prototype,"_settingsEcEntity",void 0),e([ut()],Ht.prototype,"_settingsPhEntity2",void 0),e([ut()],Ht.prototype,"_settingsPhMin2",void 0),e([ut()],Ht.prototype,"_settingsPhMax2",void 0),e([ut()],Ht.prototype,"_settingsEcEntity2",void 0),e([ut()],Ht.prototype,"_settingsError",void 0),e([ut()],Ht.prototype,"_editingId",void 0),e([ut()],Ht.prototype,"_formTime",void 0),e([ut()],Ht.prototype,"_formDays",void 0),e([ut()],Ht.prototype,"_formDurationHour",void 0),e([ut()],Ht.prototype,"_formDurationMin",void 0),e([ut()],Ht.prototype,"_formDurationSec",void 0),e([ut()],Ht.prototype,"_formError",void 0),customElements.get("irrigation-schedule-card")||customElements.define("irrigation-schedule-card",Ht),customElements.get("irrigation-schedule-card-editor")||customElements.define("irrigation-schedule-card-editor",yt),window.customCards=window.customCards||[],window.customCards.some(t=>"irrigation-schedule-card"===t.type)||window.customCards.push({type:"irrigation-schedule-card",name:"Irrigation Scheduler",description:"Controle e agende a irrigação de uma zona (irrigation_scheduler).",preview:!1}),t.IrrigationScheduleCard=Ht,t.validateCardConfig=Rt,t}({});
