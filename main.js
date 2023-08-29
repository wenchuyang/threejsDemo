;(function () {
  // Set our main variables
  let scene,
    renderer,
    camera,
    model, // Our character
    neck, // 脖子Reference to the neck bone in the skeleton
    waist, // 腰Reference to the waist bone in the skeleton
    possibleAnims, // Animations found in our file
    mixer, // THREE.js animations mixer
    idle, // Idle, the default state our character returns to
    clock = new THREE.Clock(), // Used for anims, which run to a clock instead of frame rate
    currentlyAnimating = false, // Used to check whether characters neck is being used in another anim
    raycaster = new THREE.Raycaster(), // 检测角色的点击事件
    loaderAnim = document.getElementById('js-loader')

  init()
  /**
   * 初始化函数
   * 1. 初始化场景：设置背景色
   * 2. 初始化渲染器
   * 3. 添加摄像机
   * 4. 加载3D模型并混合材质
   * 5. 添加光源
   * 6. 添加地板
   * 7. 生成一个球体并放到场景中（可以删掉）
   */
  function init() {
    const MODEL_PATH = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/1376484/blender-tut-stacy.glb' //'./models/katy_perry_avatar.glb'
    const canvas = document.querySelector('#c')
    const backgroundColor = '#ccc'

    // 初始化场景
    scene = new THREE.Scene()
    scene.background = new THREE.Color(backgroundColor)
    scene.fog = new THREE.Fog(backgroundColor, 60, 100) // 背景中间的虚化效果

    // 初始化渲染器（renderer）
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.shadowMap.enabled = true // 人物投影
    renderer.setPixelRatio(window.devicePixelRatio) // 基于设备设置像素比
    document.body.appendChild(renderer.domElement)

    // 添加透视摄像机
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 30
    camera.position.x = 0
    camera.position.y = -3

    // 创建纹理贴图
    let stacy_txt = new THREE.TextureLoader().load(
      'https://s3-us-west-2.amazonaws.com/s.cdpn.io/1376484/stacy.jpg'
    )
    stacy_txt.flipY = false
    // 材质
    const stacy_mtl = new THREE.MeshPhongMaterial({
      map: stacy_txt,
      color: '#fff',
      skinning: true
    })

    // 3d模型加载器
    var loader = new THREE.GLTFLoader()

    loader.load(
      MODEL_PATH, // 模型路径
      function (gltf) {
        // 加载成功后的回调函数
        model = gltf.scene
        let fileAnimations = gltf.animations

        // 遍历模型层次结构
        model.traverse(o => {
          if (o.isMesh) {
            o.castShadow = true
            o.receiveShadow = true
            o.material = stacy_mtl
          }
          // Reference the neck and waist bones
          if (o.isBone && o.name === 'mixamorigNeck') {
            neck = o // 脖子
          }
          if (o.isBone && o.name === 'mixamorigSpine') {
            waist = o // 脊柱
          }
        })

        model.scale.set(0.65, 0.65, 0.65)
        model.position.y = -11

        scene.add(model)

        loaderAnim.remove()

        // 新建动画混合器，混合模型动画
        mixer = new THREE.AnimationMixer(model)

        let clips = fileAnimations.filter(val => val.name !== 'idle')
        possibleAnims = clips.map(val => {
          let clip = THREE.AnimationClip.findByName(clips, val.name)
          // 把其它动画中涉及到脖子和脊柱的动画找出来并移除
          clip.tracks.splice(3, 3)
          clip.tracks.splice(9, 3)

          clip = mixer.clipAction(clip)
          return clip
        })
        // 把空闲动画中涉及到脖子和脊柱的动画找出来并移除
        let idleAnim = THREE.AnimationClip.findByName(fileAnimations, 'idle')

        idleAnim.tracks.splice(3, 3)
        idleAnim.tracks.splice(9, 3)

        idle = mixer.clipAction(idleAnim)
        idle.play()
      },
      undefined, // 加载中的回调函数
      function (error) {
        // 报错的回调函数
        console.error(error)
      }
    )

    // 添加光源
    let hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.61) // 半球光（天空，地面，光照强度）
    hemiLight.position.set(0, 50, 0)
    // Add hemisphere light to scene
    scene.add(hemiLight)

    // 添加定向光
    let d = 8.25
    let dirLight = new THREE.DirectionalLight(0xffffff, 0.54)
    dirLight.position.set(-8, 12, 8)
    dirLight.castShadow = true
    dirLight.shadow.mapSize = new THREE.Vector2(1024, 1024)
    dirLight.shadow.camera.near = 0.1
    dirLight.shadow.camera.far = 1500
    dirLight.shadow.camera.left = d * -1
    dirLight.shadow.camera.right = d
    dirLight.shadow.camera.top = d
    dirLight.shadow.camera.bottom = d * -1
    // Add directional Light to scene
    scene.add(dirLight)

    // 地板
    let floorGeometry = new THREE.PlaneGeometry(5000, 5000, 1, 1) // 地板的大小
    // 地板的材质
    let floorMaterial = new THREE.MeshPhongMaterial({
      color: '#aaa',
      shininess: 0
    })

    // 给场景添加地板
    let floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -0.5 * Math.PI
    floor.receiveShadow = true
    floor.position.y = -11
    scene.add(floor)

    // 生成一个球体
    let geometry = new THREE.SphereGeometry(8, 32, 32)
    // 球体的材质
    let material = new THREE.MeshBasicMaterial({ color: '#f2ccff' }) // 0xf2ce2e
    // 混合球体和材质生成一个球
    let sphere = new THREE.Mesh(geometry, material)

    sphere.position.z = -15
    sphere.position.y = -2.5
    sphere.position.x = -0.25
    scene.add(sphere)
  }

  /**
   * 更新函数，每帧都执行
   *
   */
  function update() {
    // 推进混合器时间并更新动画
    if (mixer) {
      mixer.update(clock.getDelta())
    }

    // 如果需要调整大小，同时调整摄像机的方向
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement
      camera.aspect = canvas.clientWidth / canvas.clientHeight
      // 更新摄像机的投影矩阵以反映摄像机视角的更改
      camera.updateProjectionMatrix()
    }
    // 渲染场景
    renderer.render(scene, camera)
    requestAnimationFrame(update)
  }

  update()

  /**
   * 判断是否需要对场景做resize
   * @param {*} renderer 渲染器
   * @returns {boolean}
   */
  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement
    let width = window.innerWidth
    let height = window.innerHeight
    let canvasPixelWidth = canvas.width / window.devicePixelRatio
    let canvasPixelHeight = canvas.height / window.devicePixelRatio

    const needResize = canvasPixelWidth !== width || canvasPixelHeight !== height
    if (needResize) {
      renderer.setSize(width, height, false)
    }
    return needResize
  }

  // 添加事件监听，分别对应pc和触屏
  window.addEventListener('click', e => raycast(e))
  window.addEventListener('touchend', e => raycast(e, true))

  // 采用射线实现点击，从摄像机向鼠标位置发射激光束，返回被击中的对象
  function raycast(e, touch = false) {
    var mouse = {}
    if (touch) {
      mouse.x = 2 * (e.changedTouches[0].clientX / window.innerWidth) - 1
      mouse.y = 1 - 2 * (e.changedTouches[0].clientY / window.innerHeight)
    } else {
      mouse.x = 2 * (e.clientX / window.innerWidth) - 1
      mouse.y = 1 - 2 * (e.clientY / window.innerHeight)
    }
    // 用相机和鼠标的位置更新射线
    // update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera)

    // 计算被射线击中的对象
    // calculate objects intersecting the picking ray
    var intersects = raycaster.intersectObjects(scene.children, true)

    if (intersects[0]) {
      var object = intersects[0].object

      if (object.name === 'stacy') {
        if (!currentlyAnimating) {
          currentlyAnimating = true
          playOnClick()
        }
      }
    }
  }

  // 随机获取一个动画并执行
  function playOnClick() {
    let anim = Math.floor(Math.random() * possibleAnims.length) + 0
    playModifierAnimation(idle, 0.25, possibleAnims[anim], 0.25)
  }

  /**
   * 动画的过渡
   * @param {*} from 从什么状态，比如闲置 idle
   * @param {*} fSpeed from到to 的过渡时间
   * @param {*} to 过渡到什么状态，比如挥手
   * @param {*} tSpeed to到from 的过渡时间
   */
  function playModifierAnimation(from, fSpeed, to, tSpeed) {
    to.setLoop(THREE.LoopOnce) // 设置动画循环方式为 LoopOnce(循环一次)
    to.reset()
    to.play()
    from.crossFadeTo(to, fSpeed, true)
    setTimeout(function () {
      // 从当前恢复到from
      from.enabled = true
      to.crossFadeTo(from, tSpeed, true)
      currentlyAnimating = false
    }, to._clip.duration * 1000 - (tSpeed + fSpeed) * 1000)
  }

  // 在鼠标移动的时候获取鼠标位置并执行动画
  document.addEventListener('mousemove', function (e) {
    var mousecoords = getMousePos(e)
    if (neck && waist) {
      moveJoint(mousecoords, neck, 50)
      moveJoint(mousecoords, waist, 30)
    }
  })
  // 获取鼠标位置
  function getMousePos(e) {
    return { x: e.clientX, y: e.clientY }
  }

  /**
   *
   * @param {*} mouse 当前鼠标的位置
   * @param {*} joint 需要移动的关节
   * @param {*} degreeLimit 允许关节旋转的角度范围
   */
  function moveJoint(mouse, joint, degreeLimit) {
    let degrees = getMouseDegrees(mouse.x, mouse.y, degreeLimit)
    joint.rotation.y = THREE.Math.degToRad(degrees.x)
    joint.rotation.x = THREE.Math.degToRad(degrees.y)
  }

  /**
   * 判断鼠标位于视口上半部、下半部、左半部和右半部的具体位置
   * 根据鼠标与视口的距离百分比，再计算基于degreeLimit的百分比，最后返回
   * @param {*} x
   * @param {*} y
   * @param {*} degreeLimit
   * @returns
   */
  function getMouseDegrees(x, y, degreeLimit) {
    let dx = 0,
      dy = 0,
      xdiff,
      xPercentage,
      ydiff,
      yPercentage

    let w = { x: window.innerWidth, y: window.innerHeight }

    // Left (Rotates neck left between 0 and -degreeLimit)
    // 1. If cursor is in the left half of screen
    if (x <= w.x / 2) {
      // 2. Get the difference between middle of screen and cursor position
      xdiff = w.x / 2 - x
      // 3. Find the percentage of that difference (percentage toward edge of screen)
      xPercentage = (xdiff / (w.x / 2)) * 100
      // 4. Convert that to a percentage of the maximum rotation we allow for the neck
      dx = ((degreeLimit * xPercentage) / 100) * -1
    }

    // Right (Rotates neck right between 0 and degreeLimit)
    if (x >= w.x / 2) {
      xdiff = x - w.x / 2
      xPercentage = (xdiff / (w.x / 2)) * 100
      dx = (degreeLimit * xPercentage) / 100
    }
    // Up (Rotates neck up between 0 and -degreeLimit)
    if (y <= w.y / 2) {
      ydiff = w.y / 2 - y
      yPercentage = (ydiff / (w.y / 2)) * 100
      // Note that I cut degreeLimit in half when she looks up
      dy = ((degreeLimit * 0.5 * yPercentage) / 100) * -1
    }
    // Down (Rotates neck down between 0 and degreeLimit)
    if (y >= w.y / 2) {
      ydiff = y - w.y / 2
      yPercentage = (ydiff / (w.y / 2)) * 100
      dy = (degreeLimit * yPercentage) / 100
    }
    return { x: dx, y: dy }
  }
})()
