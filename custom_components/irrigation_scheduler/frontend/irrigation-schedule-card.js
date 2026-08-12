var IrrigationScheduleCard=function(t){"use strict";function e(t,e,i,s){var r,n=arguments.length,o=n<3?e:null===s?s=Object.getOwnPropertyDescriptor(e,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)o=Reflect.decorate(t,e,i,s);else for(var a=t.length-1;a>=0;a--)(r=t[a])&&(o=(n<3?r(o):n>3?r(e,i,o):r(e,i))||o);return n>3&&o&&Object.defineProperty(e,i,o),o}"function"==typeof SuppressedError&&SuppressedError;const i=globalThis,s=i.ShadowRoot&&(void 0===i.ShadyCSS||i.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,r=Symbol(),n=new WeakMap;let o=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==r)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(s&&void 0===t){const i=void 0!==e&&1===e.length;i&&(t=n.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&n.set(e,t))}return t}toString(){return this.cssText}};const a=s?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new o("string"==typeof t?t:t+"",void 0,r))(e)})(t):t,{is:c,defineProperty:d,getOwnPropertyDescriptor:h,getOwnPropertyNames:l,getOwnPropertySymbols:p,getPrototypeOf:u}=Object,g=globalThis,_=g.trustedTypes,m=_?_.emptyScript:"",f=g.reactiveElementPolyfillSupport,v=(t,e)=>t,y={toAttribute(t,e){switch(e){case Boolean:t=t?m:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},b=(t,e)=>!c(t,e),$={attribute:!0,type:String,converter:y,reflect:!1,useDefault:!1,hasChanged:b};Symbol.metadata??=Symbol("metadata"),g.litPropertyMetadata??=new WeakMap;let x=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=$){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&d(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:r}=h(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const n=s?.call(this);r?.call(this,e),this.requestUpdate(t,n,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??$}static _$Ei(){if(this.hasOwnProperty(v("elementProperties")))return;const t=u(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(v("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(v("properties"))){const t=this.properties,e=[...l(t),...p(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(a(t))}else void 0!==t&&e.push(a(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((t,e)=>{if(s)t.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const s of e){const e=document.createElement("style"),r=i.litNonce;void 0!==r&&e.setAttribute("nonce",r),e.textContent=s.cssText,t.appendChild(e)}})(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const r=(void 0!==i.converter?.toAttribute?i.converter:y).toAttribute(e,i.type);this._$Em=t,null==r?this.removeAttribute(s):this.setAttribute(s,r),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),r="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:y;this._$Em=s;const n=r.fromAttribute(e,t.type);this[s]=n??this._$Ej?.get(s)??n,this._$Em=null}}requestUpdate(t,e,i,s=!1,r){if(void 0!==t){const n=this.constructor;if(!1===s&&(r=this[t]),i??=n.getPropertyOptions(t),!((i.hasChanged??b)(r,e)||i.useDefault&&i.reflect&&r===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:r},n){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),!0!==r||void 0!==n)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};x.elementStyles=[],x.shadowRootOptions={mode:"open"},x[v("elementProperties")]=new Map,x[v("finalized")]=new Map,f?.({ReactiveElement:x}),(g.reactiveElementVersions??=[]).push("2.1.2");const w=globalThis,S=t=>t,E=w.trustedTypes,A=E?E.createPolicy("lit-html",{createHTML:t=>t}):void 0,C="$lit$",P=`lit$${Math.random().toFixed(9).slice(2)}$`,k="?"+P,M=`<${k}>`,N=document,D=()=>N.createComment(""),O=t=>null===t||"object"!=typeof t&&"function"!=typeof t,T=Array.isArray,z="[ \t\n\f\r]",R=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,U=/-->/g,I=/>/g,H=RegExp(`>|${z}(?:([^\\s"'>=/]+)(${z}*=${z}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),j=/'/g,F=/"/g,L=/^(?:script|style|textarea|title)$/i,W=(t=>(e,...i)=>({_$litType$:t,strings:e,values:i}))(1),B=Symbol.for("lit-noChange"),q=Symbol.for("lit-nothing"),V=new WeakMap,J=N.createTreeWalker(N,129);function K(t,e){if(!T(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==A?A.createHTML(e):e}const Q=(t,e)=>{const i=t.length-1,s=[];let r,n=2===e?"<svg>":3===e?"<math>":"",o=R;for(let e=0;e<i;e++){const i=t[e];let a,c,d=-1,h=0;for(;h<i.length&&(o.lastIndex=h,c=o.exec(i),null!==c);)h=o.lastIndex,o===R?"!--"===c[1]?o=U:void 0!==c[1]?o=I:void 0!==c[2]?(L.test(c[2])&&(r=RegExp("</"+c[2],"g")),o=H):void 0!==c[3]&&(o=H):o===H?">"===c[0]?(o=r??R,d=-1):void 0===c[1]?d=-2:(d=o.lastIndex-c[2].length,a=c[1],o=void 0===c[3]?H:'"'===c[3]?F:j):o===F||o===j?o=H:o===U||o===I?o=R:(o=H,r=void 0);const l=o===H&&t[e+1].startsWith("/>")?" ":"";n+=o===R?i+M:d>=0?(s.push(a),i.slice(0,d)+C+i.slice(d)+P+l):i+P+(-2===d?e:l)}return[K(t,n+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class Z{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let r=0,n=0;const o=t.length-1,a=this.parts,[c,d]=Q(t,e);if(this.el=Z.createElement(c,i),J.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=J.nextNode())&&a.length<o;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(C)){const e=d[n++],i=s.getAttribute(t).split(P),o=/([.?@])?(.*)/.exec(e);a.push({type:1,index:r,name:o[2],strings:i,ctor:"."===o[1]?et:"?"===o[1]?it:"@"===o[1]?st:tt}),s.removeAttribute(t)}else t.startsWith(P)&&(a.push({type:6,index:r}),s.removeAttribute(t));if(L.test(s.tagName)){const t=s.textContent.split(P),e=t.length-1;if(e>0){s.textContent=E?E.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],D()),J.nextNode(),a.push({type:2,index:++r});s.append(t[e],D())}}}else if(8===s.nodeType)if(s.data===k)a.push({type:2,index:r});else{let t=-1;for(;-1!==(t=s.data.indexOf(P,t+1));)a.push({type:7,index:r}),t+=P.length-1}r++}}static createElement(t,e){const i=N.createElement("template");return i.innerHTML=t,i}}function G(t,e,i=t,s){if(e===B)return e;let r=void 0!==s?i._$Co?.[s]:i._$Cl;const n=O(e)?void 0:e._$litDirective$;return r?.constructor!==n&&(r?._$AO?.(!1),void 0===n?r=void 0:(r=new n(t),r._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=r:i._$Cl=r),void 0!==r&&(e=G(t,r._$AS(t,e.values),r,s)),e}class X{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??N).importNode(e,!0);J.currentNode=s;let r=J.nextNode(),n=0,o=0,a=i[0];for(;void 0!==a;){if(n===a.index){let e;2===a.type?e=new Y(r,r.nextSibling,this,t):1===a.type?e=new a.ctor(r,a.name,a.strings,this,t):6===a.type&&(e=new rt(r,this,t)),this._$AV.push(e),a=i[++o]}n!==a?.index&&(r=J.nextNode(),n++)}return J.currentNode=N,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}}class Y{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=q,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=G(this,t,e),O(t)?t===q||null==t||""===t?(this._$AH!==q&&this._$AR(),this._$AH=q):t!==this._$AH&&t!==B&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>T(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==q&&O(this._$AH)?this._$AA.nextSibling.data=t:this.T(N.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=Z.createElement(K(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new X(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=V.get(t.strings);return void 0===e&&V.set(t.strings,e=new Z(t)),e}k(t){T(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const r of t)s===e.length?e.push(i=new Y(this.O(D()),this.O(D()),this,this.options)):i=e[s],i._$AI(r),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=S(t).nextSibling;S(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}class tt{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,r){this.type=1,this._$AH=q,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=r,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=q}_$AI(t,e=this,i,s){const r=this.strings;let n=!1;if(void 0===r)t=G(this,t,e,0),n=!O(t)||t!==this._$AH&&t!==B,n&&(this._$AH=t);else{const s=t;let o,a;for(t=r[0],o=0;o<r.length-1;o++)a=G(this,s[i+o],e,o),a===B&&(a=this._$AH[o]),n||=!O(a)||a!==this._$AH[o],a===q?t=q:t!==q&&(t+=(a??"")+r[o+1]),this._$AH[o]=a}n&&!s&&this.j(t)}j(t){t===q?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class et extends tt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===q?void 0:t}}class it extends tt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==q)}}class st extends tt{constructor(t,e,i,s,r){super(t,e,i,s,r),this.type=5}_$AI(t,e=this){if((t=G(this,t,e,0)??q)===B)return;const i=this._$AH,s=t===q&&i!==q||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,r=t!==q&&(i===q||s);s&&this.element.removeEventListener(this.name,this,i),r&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class rt{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){G(this,t)}}const nt=w.litHtmlPolyfillSupport;nt?.(Z,Y),(w.litHtmlVersions??=[]).push("3.3.3");const ot=globalThis;class at extends x{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let r=s._$litPart$;if(void 0===r){const t=i?.renderBefore??null;s._$litPart$=r=new Y(e.insertBefore(D(),t),t,void 0,i??{})}return r._$AI(t),r})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return B}}at._$litElement$=!0,at.finalized=!0,ot.litElementHydrateSupport?.({LitElement:at});const ct=ot.litElementPolyfillSupport;ct?.({LitElement:at}),(ot.litElementVersions??=[]).push("4.2.2");const dt={attribute:!0,type:String,converter:y,reflect:!1,hasChanged:b},ht=(t=dt,e,i)=>{const{kind:s,metadata:r}=i;let n=globalThis.litPropertyMetadata.get(r);if(void 0===n&&globalThis.litPropertyMetadata.set(r,n=new Map),"setter"===s&&((t=Object.create(t)).wrapped=!0),n.set(i.name,t),"accessor"===s){const{name:s}=i;return{set(i){const r=e.get.call(this);e.set.call(this,i),this.requestUpdate(s,r,t,!0,i)},init(e){return void 0!==e&&this.C(s,void 0,t,e),e}}}if("setter"===s){const{name:s}=i;return function(i){const r=this[s];e.call(this,i),this.requestUpdate(s,r,t,!0,i)}}throw Error("Unsupported decorator location: "+s)};function lt(t){return(e,i)=>"object"==typeof i?ht(t,e,i):((t,e,i)=>{const s=e.hasOwnProperty(i);return e.constructor.createProperty(i,t),s?Object.getOwnPropertyDescriptor(e,i):void 0})(t,e,i)}function pt(t){return lt({...t,state:!0,attribute:!1})}const ut="irrigation_scheduler",gt=!0,_t=!0,mt=!1,ft=[{name:"entity",selector:{entity:{domain:"sensor"}}},{name:"name",selector:{text:{}}},{name:"show_next_run",selector:{boolean:{}}},{name:"show_water_now",selector:{boolean:{}}},{name:"compact",selector:{boolean:{}}}],vt={entity:"Entidade (sensor.<zona>_next_run)",name:"Nome",show_next_run:"Mostrar próximo horário",show_water_now:"Mostrar regar agora",compact:"Compacto"};class yt extends at{constructor(){super(...arguments),this._computeLabel=t=>vt[t.name]??t.name}render(){return this.hass&&this.config?W`
      <ha-form
        .hass=${this.hass}
        .data=${this.config}
        .schema=${ft}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `:W``}_valueChanged(t){const e=t.detail,i=e?.name;if(!i||!this.config)return;const s={...this.config,[i]:e.value};this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:s},bubbles:!0,composed:!0}))}}e([lt({attribute:!1})],yt.prototype,"hass",void 0),e([lt({attribute:!1})],yt.prototype,"config",void 0);const bt=((t,...e)=>{const i=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new o(i,t,r)})`
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
    flex-direction: column;
    gap: 4px;
    padding: 8px 0;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
  }

  .schedule-row:last-child {
    border-bottom: none;
  }

  .schedule-row-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .schedule-row-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .schedule-row-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .schedule-row ha-switch {
    --mdc-switch-track-height: 20px;
    --mdc-switch-track-width: 36px;
    --mdc-switch-state-layer-size: 26px;
    flex-shrink: 0;
  }

  .schedule-time {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .schedule-days {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .day-chip {
    font-size: 0.7rem;
    padding: 2px 5px;
    border-radius: 4px;
    background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
    color: var(--secondary-text-color);
  }

  .day-chip.all-days {
    font-weight: 500;
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }

  .warning-icon {
    --mdc-icon-size: 18px;
    color: var(--warning-color, #ff9800);
    flex-shrink: 0;
  }

  .schedule-duration {
    font-size: 0.85rem;
    color: var(--secondary-text-color);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .schedule-volume {
    font-size: 0.75rem;
    color: var(--primary-color, #03a9f4);
    font-weight: 500;
    margin-left: 6px;
  }

  .schedule-perpot {
    font-size: 0.75rem;
    color: var(--secondary-text-color);
    font-weight: 400;
    margin-left: 4px;
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
    --mdc-icon-button-size: 30px;
    --mdc-icon-size: 16px;
  }

  .empty {
    padding: 16px 0;
    text-align: center;
    color: var(--secondary-text-color);
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    align-items: stretch;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }

  .actions ha-button {
    --mdc-button-height: 34px;
    --mdc-button-horizontal-padding: 12px;
    --mdc-typography-button-font-size: 0.8rem;
    flex: 1 1 0;
    min-width: 140px;
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
  .compact .next-run {
    display: none;
  }
`,$t=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"],xt=/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;function wt(t){const e=xt.exec(t);if(!e)return null;const i=Number(e[1]),s=Number(e[2]),r=e[3]?Number(e[3]):0;return i>23||s>59||r>59?null:{hour:i,minute:s,second:r}}function St(t){const e=wt(t);if(!e)return t;const i=t.slice(0,t.indexOf(":")),s=String(e.minute).padStart(2,"0");return e.second>0?`${i}:${s}:${String(e.second).padStart(2,"0")}`:`${i}:${s}`}function Et(t,e){const i=function(t,e){const i=Number.isFinite(t)?t:0;return i<=0?null:i/3600*(Number.isFinite(e)?Math.max(0,e):0)}(t,e);return null===i?null:1e3*i}function At(t){return Number.isFinite(t)?t>=1e3?(e=t/1e3,Number.isFinite(e)?Math.round(100*e)/100+" L":"0 L"):Math.round(100*t)/100+" ml":"0 ml";var e}function Ct(t){const e=wt(t);if(!e)return t;return`${String(e.hour).padStart(2,"0")}:${String(e.minute).padStart(2,"0")}:${String(e.second).padStart(2,"0")}`}function Pt(t){if(!t||"object"!=typeof t)throw new Error("Configuração inválida para o card de irrigação.");const e=t.entity;if("string"!=typeof e||0===e.length||!e.startsWith("sensor."))throw new Error('O card exige um sensor da integração: "sensor.<zona>_next_run".')}class kt extends at{constructor(){super(...arguments),this._config={type:"custom:irrigation-schedule-card"},this._now=0,this._dialogOpen=!1,this._settingsOpen=!1,this._settingsFlow="",this._settingsPots="",this._settingsReservoir="",this._settingsPhEntity="",this._settingsPhEntityTouched=!1,this._settingsPhMin="",this._settingsPhMax="",this._settingsError=null,this._editingId=null,this._formTime="06:00",this._formDays=[],this._formDurationMin=15,this._formDurationSec=0,this._formError=!1,this._tickerId=null}static{this.styles=bt}static getConfigElement(){return document.createElement("irrigation-schedule-card-editor")}static getStubConfig(){return{show_next_run:gt,show_water_now:_t,compact:mt}}setConfig(t){Pt(t),this._config={...t}}getCardSize(){return this._config.compact?2:4}disconnectedCallback(){super.disconnectedCallback(),this._stopTicker()}updated(t){super.updated(t),this._isWatering()?null===this._tickerId&&(this._tickerId=window.setInterval(()=>{this._now=Date.now()},1e3)):null!==this._tickerId&&this._stopTicker()}render(){if(!this.hass)return this._renderConfigError("O card ainda não recebeu o objeto hass do Home Assistant.");try{if(!this._config.entity)return this._renderConfigError("Configure o card com o sensor da zona: sensor.<zona>_next_run.");if(!this._config.entity.startsWith("sensor."))return this._renderConfigError(`"${this._config.entity}" não é um sensor da integração irrigation_scheduler.`);const t=this._sensorEntity;return t?this._renderCard(t):this._renderConfigError(`Entidade "${this._config.entity}" não encontrada.`)}catch(t){return console.error("[irrigation-schedule-card] render failed",t),this._renderConfigError(`Falha ao renderizar o card: ${t instanceof Error?t.message:String(t)}`)}}_renderConfigError(t){return W`
      <ha-card>
        <div class="config-error">
          <ha-icon icon="mdi:alert-outline"></ha-icon>
          <div>${t}</div>
        </div>
      </ha-card>
    `}_renderCard(t){const e=this._config.compact??mt,i=this._config.show_next_run??gt,s=this._config.show_water_now??_t,r=[...$t],n=function(t){if(!Array.isArray(t))return[];const e=[];for(const i of t){if(null===i||"object"!=typeof i)continue;const t=i,s="string"==typeof t.time&&null!==wt(t.time)?Ct(t.time):"",r=Array.isArray(t.days)?t.days.filter(t=>"number"==typeof t&&Number.isInteger(t)&&t>=0&&t<=6):[],n="number"==typeof t.duration&&Number.isFinite(t.duration)&&t.duration>0?t.duration:0;!s||0===r.length||n<=0||e.push({id:"string"==typeof t.id?t.id:"",time:s,days:[...new Set(r)].sort((t,e)=>t-e),duration:n,enabled:"boolean"!=typeof t.enabled||t.enabled})}return e}(t.attributes.schedules),o=this._numberAttr(t,"flow_rate_lph")??0,a=this._numberAttr(t,"number_of_pots")??0,c=this._numberAttr(t,"reservoir_volume_l")??0,d=this._stringAttr(t,"ph_entity_id")??"",h=this._numberAttr(t,"ph_min")??0,l=this._numberAttr(t,"ph_max")??14,p=this._scheduleWarnings(t),u=this._switchEid?this.hass?.states[this._switchEid]:void 0,g=this._binarySensorEid?this.hass?.states[this._binarySensorEid]:void 0,_="on"===g?.state,m="on"===u?.state,f=_?"Regando":m?"Agendada":"Desabilitada",v=_?"status-watering":m?"status-scheduled":"status-disabled",y=this._stringAttr(g,"finishes_at"),b=this._stringAttr(g,"started_at"),$=this._now>0?new Date(this._now).toISOString():(new Date).toISOString(),x=y?function(t,e){const i=Date.parse(t),s=Date.parse(e);return Number.isFinite(i)&&Number.isFinite(s)?Math.max(0,Math.floor((i-s)/1e3)):0}(y,$):0,w=b&&y?function(t,e,i){const s=Date.parse(t),r=Date.parse(e),n=Date.parse(i);if(!Number.isFinite(s)||!Number.isFinite(r)||!Number.isFinite(n))return 0;const o=s-r;return o<=0?100:Math.min(100,Math.max(0,(n-r)/o*100))}(y,b,$):0;return W`
      <ha-card class=${e?"compact":""}>
        <div class="header">
          <div class="header-title" title=${this._config.entity??""}>
            ${this._zoneName(t)}
          </div>
          <div class="header-right">
            <span class="status ${v}">${f}</span>
            ${u?W`
                  <ha-switch
                    .checked=${m}
                    title=${m?"Agendamento ativo":"Agendamento desativado"}
                    @change=${t=>this._toggleMaster(u,t)}
                  ></ha-switch>
                `:W`<ha-switch disabled></ha-switch>`}
            <ha-icon-button
              title="Configurar vazão e vasos"
              @click=${this._openSettings}
            >
              <ha-icon icon="mdi:cog"></ha-icon>
            </ha-icon-button>
          </div>
        </div>

        ${this._renderSettings(o,a,c,d,h,l)}

        ${_&&y?W`
              <div class="watering-bar">
                <div class="watering-info">
                  <div class="watering-left">
                    <ha-icon icon="mdi:sprinkler-variant"></ha-icon>
                    <span>Regando</span>
                  </div>
                  <div class="watering-remaining">
                    ${function(t){const e=Math.max(0,Math.floor(Number.isFinite(t)?t:0)),i=Math.floor(e/3600),s=Math.floor(e%3600/60),r=e%60,n=String(s).padStart(2,"0"),o=String(r).padStart(2,"0");return i>0?`${i}:${n}:${o}`:`${n}:${o}`}(x)}
                  </div>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    style="width: ${w}%"
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

        ${!_&&i?W`
              <div class="next-run">
                <ha-icon icon="mdi:clock-start"></ha-icon>
                <span>Próximo: ${this._nextRunText(t.state)}</span>
              </div>
            `:""}

        <div class="card-body">
          <div class="schedules">
            ${0===n.length?W`<div class="empty">Nenhum horário configurado.</div>`:n.map(t=>this._renderScheduleRow(t,r,o,a,p[t.id]))}
          </div>

          <div class="actions">
            <ha-button outlined @click=${this._openAdd}>
              <ha-icon icon="mdi:plus"></ha-icon>
              Adicionar horário
            </ha-button>
            ${s?W`
                  <ha-button
                    raised
                    ?disabled=${_}
                    @click=${this._waterNow}
                  >
                    Regar agora
                  </ha-button>
                `:""}
          </div>
        </div>
      </ha-card>

      ${this._renderDialog(r)}
    `}_renderScheduleRow(t,e,i,s,r){const n=Et(i,t.duration),o=function(t,e,i){const s=Et(t,e);return null===s?null:s*(Number.isFinite(i)&&i>0?i:1)}(i,t.duration,s);return W`
      <div class="schedule-row">
        <div class="schedule-row-top">
          <div class="schedule-time">${St(t.time)}</div>
          <div class="schedule-days">
            ${a=t.days,7===a.length&&a.every(t=>t>=0&&t<=6)?W`<span class="day-chip all-days">${"Todos os dias"}</span>`:t.days.map(t=>W`<span class="day-chip">${e[t]??""}</span>`)}
          </div>
          ${r?W`
                <ha-icon
                  class="warning-icon"
                  icon="mdi:alert"
                  title=${`Última rega pulada: ${r}`}
                ></ha-icon>
              `:""}
        </div>
        <div class="schedule-row-bottom">
          <div class="schedule-duration">
            ${function(t){const e=Math.max(0,Math.round(Number.isFinite(t)?t:0));if(e<60)return`${e} s`;const i=Math.round(e/60),s=Math.floor(i/60),r=i%60,n=[];return s>0&&n.push(`${s} h`),r>0&&n.push(`${r} min`),n.join(" ")}(t.duration)}
            ${null!==o?W`<span class="schedule-volume">≈ ${At(o)}</span>`:""}
            ${null!==o&&null!==n?W`<span class="schedule-perpot">· ${At(n)}/vaso</span>`:""}
          </div>
          <div class="schedule-row-controls">
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
        </div>
      </div>
    `;var a}_renderSettings(t,e,i,s,r,n){return this._settingsOpen?W`
      <div class="settings-panel">
        <div class="field">
          <label>Vazão (L/h)</label>
          <input
            type="number"
            min="0"
            .value=${this._settingsFlow||String(t)}
            @change=${this._onSettingsFlowChange}
          />
        </div>
        <div class="field">
          <label>Número de vasos</label>
          <input
            type="number"
            min="0"
            .value=${this._settingsPots||String(e)}
            @change=${this._onSettingsPotsChange}
          />
        </div>
        <div class="field">
          <label>Volume do reservatório (L)</label>
          <input
            type="number"
            min="0"
            .value=${this._settingsReservoir||String(i)}
            @change=${this._onSettingsReservoirChange}
          />
        </div>
        <div class="field">
          <label>Sensor de pH (opcional)</label>
          <input
            type="text"
            list="ph-sensor-options"
            placeholder="sensor.reservatorio_ph"
            .value=${this._settingsPhEntity||s}
            @change=${this._onSettingsPhEntityChange}
          />
          <datalist id="ph-sensor-options">
            ${this._sensorEntityIds().map(t=>W`<option value=${t}></option>`)}
          </datalist>
        </div>
        <div class="field">
          <label>Só regar (agendado) com pH entre</label>
          <div class="duration-row">
            <div class="duration-part">
              <input
                type="number"
                min="0"
                max="14"
                step="0.1"
                .value=${this._settingsPhMin||String(r)}
                @change=${this._onSettingsPhMinChange}
              />
            </div>
            <div class="duration-part">
              <input
                type="number"
                min="0"
                max="14"
                step="0.1"
                .value=${this._settingsPhMax||String(n)}
                @change=${this._onSettingsPhMaxChange}
              />
            </div>
          </div>
        </div>
        ${this._settingsError?W`<div class="form-error">${this._settingsError}</div>`:""}
        <div class="settings-actions">
          <button class="dialog-cancel" @click=${this._closeSettings}>
            Fechar
          </button>
          <button class="dialog-save" @click=${this._saveSettings}>Salvar</button>
        </div>
      </div>
    `:W``}_openSettings(){this._settingsOpen=!this._settingsOpen}_closeSettings(){this._settingsOpen=!1,this._settingsFlow="",this._settingsPots="",this._settingsReservoir="",this._settingsPhEntity="",this._settingsPhEntityTouched=!1,this._settingsPhMin="",this._settingsPhMax="",this._settingsError=null}_onSettingsFlowChange(t){this._settingsFlow=t.target.value}_onSettingsPotsChange(t){this._settingsPots=t.target.value}_onSettingsReservoirChange(t){this._settingsReservoir=t.target.value}_onSettingsPhEntityChange(t){this._settingsPhEntity=t.target.value.trim(),this._settingsPhEntityTouched=!0,this._settingsError=null}_onSettingsPhMinChange(t){this._settingsPhMin=t.target.value,this._settingsError=null}_onSettingsPhMaxChange(t){this._settingsPhMax=t.target.value,this._settingsError=null}_saveSettings(){const t=Number.parseInt(this._settingsFlow,10),e=Number.parseInt(this._settingsPots,10),i=Number.parseInt(this._settingsReservoir,10),s={};Number.isFinite(t)&&t>=0&&(s.flow_rate_lph=t),Number.isFinite(e)&&e>=0&&(s.number_of_pots=e),Number.isFinite(i)&&i>=0&&(s.reservoir_volume_l=i);const r=Number.parseFloat(this._settingsPhMin),n=Number.parseFloat(this._settingsPhMax),o=Number.isFinite(r)&&r>=0&&r<=14,a=Number.isFinite(n)&&n>=0&&n<=14;o&&a&&r>n?this._settingsError="O pH mínimo não pode ser maior que o pH máximo.":(o&&(s.ph_min=r),a&&(s.ph_max=n),this._settingsPhEntityTouched&&(s.ph_entity_id=this._settingsPhEntity),this._callService("set_zone_options",s),this._closeSettings())}_renderDialog(t){return this._dialogOpen?W`
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
                ${t.map((t,e)=>W`
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
              <div class="duration-row">
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    .value=${String(this._formDurationMin)}
                    @change=${this._onDurationMinChange}
                  />
                  <span>min</span>
                </div>
                <div class="duration-part">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    .value=${String(this._formDurationSec)}
                    @change=${this._onDurationSecChange}
                  />
                  <span>seg</span>
                </div>
              </div>
            </div>
            ${this._formError?W`
                  <div class="form-error">
                    Informe um horário, ao menos um dia e uma duração válida.
                  </div>
                `:""}
          </div>
          <div class="dialog-actions">
            <button class="dialog-cancel" @click=${this._closeDialog}>
              Cancelar
            </button>
            <button class="dialog-save" @click=${this._saveDialog}>Salvar</button>
          </div>
        </div>
      </div>
    `:W``}get _sensorEntity(){const t=this._config.entity;return t?this.hass?.states[t]:void 0}get _switchEid(){return this._stringAttr(this._sensorEntity,"switch_entity_id")}get _binarySensorEid(){return this._stringAttr(this._sensorEntity,"binary_sensor_entity_id")}_isWatering(){const t=this._binarySensorEid;return!!t&&"on"===this.hass?.states[t]?.state}_stringAttr(t,e){const i=t?.attributes[e];return"string"==typeof i&&i?i:void 0}_numberAttr(t,e){const i=t?.attributes[e];return"number"==typeof i&&Number.isFinite(i)?i:void 0}_scheduleWarnings(t){const e=t?.attributes.schedule_warnings;if(!e||"object"!=typeof e)return{};const i={};for(const[t,s]of Object.entries(e))"string"==typeof s&&(i[t]=s);return i}_sensorEntityIds(){return this.hass?Object.keys(this.hass.states).filter(t=>t.startsWith("sensor.")).sort():[]}_zoneName(t){const e=this._config.name;if(e&&e.trim())return e;const i=this._stringAttr(t,"friendly_name");if(!i)return this._config.entity??"";const s=[" próxima execução"," next run"," próximo horário"," proximo horario"];for(const t of s)if(i.toLowerCase().endsWith(t))return i.slice(0,i.length-t.length).trim();return i}_nextRunText(t){const e=new Date(t);return!t||Number.isNaN(e.getTime())?"Nenhum horário agendado":new Intl.DateTimeFormat("pt-BR",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(e)}_stopTicker(){null!==this._tickerId&&(window.clearInterval(this._tickerId),this._tickerId=null),this._now=0}_callService(t,e={}){if(!this.hass)return;const i=this._config.entity;i&&this.hass.callService(ut,t,e,{entity_id:i}).catch(e=>{console.error(`[irrigation-schedule-card] ${ut}.${t} failed`,e)})}_waterNow(){this._callService("water_now")}_toggleMaster(t,e){const i=e.target.checked;this.hass&&this.hass.callService("switch",i?"turn_on":"turn_off",{},{entity_id:t.entity_id}).catch(t=>{console.error("[irrigation-schedule-card] switch toggle failed",t)})}_stopWatering(){this._callService("stop")}_toggleScheduleEnabled(t,e){const i=e.target.checked;this._callService("update_schedule",{id:t.id,enabled:i})}_deleteSchedule(t){window.confirm(`Excluir o horário das ${St(t.time)}?`)&&this._callService("remove_schedule",{id:t.id})}_openAdd(){this._editingId=null,this._formTime="06:00",this._formDays=[],this._formDurationMin=this._defaultDurationMinutes(),this._formDurationSec=0,this._formError=!1,this._dialogOpen=!0}_openEdit(t){this._editingId=t.id,this._formTime=St(t.time),this._formDays=[...t.days];const e=Math.max(1,Math.round(t.duration));this._formDurationMin=Math.floor(e/60),this._formDurationSec=e%60,this._formError=!1,this._dialogOpen=!0}_closeDialog(){this._dialogOpen=!1,this._editingId=null,this._formError=!1}_saveDialog(){const t=Ct(this._formTime),e=[...this._formDays].sort((t,e)=>t-e),i=60*this._formDurationMin+this._formDurationSec;(function(t){const e=wt(t);return e?3600*e.hour+60*e.minute+e.second:-1})(t)<0||0===e.length||i<=0?this._formError=!0:(this._editingId?this._callService("update_schedule",{id:this._editingId,time:t,days:e,duration:i}):this._callService("add_schedule",{time:t,days:e,duration:i,enabled:!0}),this._closeDialog())}_onTimeChanged(t){const e=t.target.value;"string"==typeof e&&(this._formTime=e,this._formError=!1)}_toggleDay(t,e){if(t<0||t>6)return;const i=e.target.checked;this._formDays=i?[...this._formDays,t]:this._formDays.filter(e=>e!==t),this._formError=!1}_onDurationMinChange(t){const e=t.target.value,i=Number.parseInt(e,10);this._formDurationMin=Number.isFinite(i)&&i>=0?i:0,this._formError=!1}_onDurationSecChange(t){const e=t.target.value,i=Number.parseInt(e,10),s=Number.isFinite(i)&&i>=0?Math.min(59,i):0;this._formDurationSec=s,this._formError=!1}_defaultDurationMinutes(){const t=this._numberAttr(this._sensorEntity,"default_duration");return!t||t<60?15:Math.max(1,Math.round(t/60))}}return e([lt({attribute:!1})],kt.prototype,"hass",void 0),e([pt()],kt.prototype,"_config",void 0),e([pt()],kt.prototype,"_now",void 0),e([pt()],kt.prototype,"_dialogOpen",void 0),e([pt()],kt.prototype,"_settingsOpen",void 0),e([pt()],kt.prototype,"_settingsFlow",void 0),e([pt()],kt.prototype,"_settingsPots",void 0),e([pt()],kt.prototype,"_settingsReservoir",void 0),e([pt()],kt.prototype,"_settingsPhEntity",void 0),e([pt()],kt.prototype,"_settingsPhMin",void 0),e([pt()],kt.prototype,"_settingsPhMax",void 0),e([pt()],kt.prototype,"_settingsError",void 0),e([pt()],kt.prototype,"_editingId",void 0),e([pt()],kt.prototype,"_formTime",void 0),e([pt()],kt.prototype,"_formDays",void 0),e([pt()],kt.prototype,"_formDurationMin",void 0),e([pt()],kt.prototype,"_formDurationSec",void 0),e([pt()],kt.prototype,"_formError",void 0),customElements.get("irrigation-schedule-card")||customElements.define("irrigation-schedule-card",kt),customElements.get("irrigation-schedule-card-editor")||customElements.define("irrigation-schedule-card-editor",yt),window.customCards=window.customCards||[],window.customCards.some(t=>"irrigation-schedule-card"===t.type)||window.customCards.push({type:"irrigation-schedule-card",name:"Irrigation Scheduler",description:"Controle e agende a irrigação de uma zona (irrigation_scheduler).",preview:!1}),t.IrrigationScheduleCard=kt,t.validateCardConfig=Pt,t}({});
